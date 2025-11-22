import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured, getCurrentUser } from '../utils/supabaseClient';

/**
 * Enhanced hook that works with Supabase for cloud sync + localStorage fallback
 * Maintains the same API as useLocalStorage for easy migration
 *
 * @param {string} tableName - Supabase table name (ideas, logs, checklist_items, etc.)
 * @param {string} localStorageKey - Fallback localStorage key
 * @param {*} initialValue - Initial value if no data exists
 * @param {Object} options - Additional options
 * @param {boolean} options.realtime - Enable real-time subscriptions (default: true)
 * @param {Function} options.transform - Transform function for data mapping
 */
export function useSupabase(tableName, localStorageKey, initialValue, options = {}) {
  const { realtime = true, transform } = options;

  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const timeoutRef = useRef(null);
  const subscriptionRef = useRef(null);
  const userIdRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const dataRef = useRef(data);

  // Keep dataRef in sync with data
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Check if we should use Supabase or fallback to localStorage
  const shouldUseSupabase = isSupabaseConfigured();

  /**
   * Load data from localStorage (used as fallback and for offline mode)
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const item = window.localStorage.getItem(localStorageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${localStorageKey} from localStorage:`, error);
      return initialValue;
    }
  }, [localStorageKey, initialValue]);

  /**
   * Save data to localStorage (used as fallback and for offline mode)
   */
  const saveToLocalStorage = useCallback((value) => {
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${localStorageKey} to localStorage:`, error);
    }
  }, [localStorageKey]);

  /**
   * Transform Supabase row to match localStorage format
   */
  const transformFromSupabase = useCallback((rows) => {
    if (!rows) return initialValue;
    if (transform) return transform(rows);
    return rows;
  }, [initialValue, transform]);

  /**
   * Load data from Supabase
   */
  const loadFromSupabase = useCallback(async () => {
    if (!shouldUseSupabase) {
      const localData = loadFromLocalStorage();
      setData(localData);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const user = await getCurrentUser();

      if (!user) {
        // No user logged in, use localStorage
        const localData = loadFromLocalStorage();
        setData(localData);
        setLoading(false);
        return;
      }

      userIdRef.current = user.id;

      // Fetch data from Supabase
      const { data: supabaseData, error: supabaseError } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      const transformedData = transformFromSupabase(supabaseData);
      const localData = loadFromLocalStorage();

      // CRITICAL FIX: Only replace local data if:
      // 1. Supabase has data, OR
      // 2. Local data is empty (nothing to lose)
      const shouldUseSupabaseData =
        (Array.isArray(transformedData) && transformedData.length > 0) ||
        (Array.isArray(localData) && localData.length === 0);

      if (shouldUseSupabaseData) {
        setData(transformedData);
        saveToLocalStorage(transformedData);
      } else {
        // Keep local data, warn user to migrate
        console.warn(`Keeping local data for ${tableName}. Use migration to sync to cloud.`);
        setData(localData);
      }

      setError(null);
    } catch (err) {
      console.error(`Error loading from Supabase:`, err);
      setError(err.message);

      // Fallback to localStorage
      const localData = loadFromLocalStorage();
      setData(localData);
    } finally {
      setLoading(false);
    }
  }, [shouldUseSupabase, tableName, loadFromLocalStorage, saveToLocalStorage, transformFromSupabase]);

  /**
   * Save data to Supabase with offline queue support
   */
  const saveToSupabase = useCallback(async (newData) => {
    if (!shouldUseSupabase || !userIdRef.current) {
      saveToLocalStorage(newData);
      return;
    }

    if (!isOnline) {
      // Queue for later sync
      offlineQueueRef.current.push({
        tableName,
        data: newData,
        timestamp: new Date().toISOString()
      });
      saveToLocalStorage(newData);
      return;
    }

    try {
      setSyncing(true);

      // For array data (ideas, logs, etc.), we need to handle inserts/updates differently
      // This is a simplified version - you may need to customize based on data type
      if (Array.isArray(newData)) {
        // Delete existing records and insert new ones (simple approach)
        // For production, you'd want smarter diffing
        await supabase
          .from(tableName)
          .delete()
          .eq('user_id', userIdRef.current);

        if (newData.length > 0) {
          const dataWithUserId = newData.map(item => ({
            ...item,
            user_id: userIdRef.current
          }));

          await supabase
            .from(tableName)
            .insert(dataWithUserId);
        }
      } else {
        // For object data (like checklist), handle as single record
        const dataWithUserId = {
          ...newData,
          user_id: userIdRef.current
        };

        await supabase
          .from(tableName)
          .upsert(dataWithUserId);
      }

      // Also save to localStorage
      saveToLocalStorage(newData);
      setError(null);
    } catch (err) {
      console.error(`Error saving to Supabase:`, err);
      setError(err.message);

      // Still save to localStorage as fallback
      saveToLocalStorage(newData);
    } finally {
      setSyncing(false);
    }
  }, [shouldUseSupabase, tableName, isOnline, saveToLocalStorage]);

  /**
   * Process offline queue when coming back online
   */
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueueRef.current.length === 0) return;

    console.log(`Processing ${offlineQueueRef.current.length} offline changes...`);

    for (const queueItem of offlineQueueRef.current) {
      try {
        await saveToSupabase(queueItem.data);
      } catch (err) {
        console.error('Error processing offline queue item:', err);
      }
    }

    offlineQueueRef.current = [];
  }, [saveToSupabase]);

  /**
   * Setup real-time subscription
   */
  const setupRealtimeSubscription = useCallback(() => {
    if (!shouldUseSupabase || !realtime || !userIdRef.current) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Subscribe to changes
    const subscription = supabase
      .channel(`${tableName}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `user_id=eq.${userIdRef.current}`
        },
        (payload) => {
          console.log('Real-time update received:', payload.eventType);
          // Don't auto-reload on every change to avoid race conditions
          // User can manually refresh if needed
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;
  }, [shouldUseSupabase, realtime, tableName]);

  /**
   * Monitor online/offline status
   */
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [processOfflineQueue]);

  /**
   * Initial data load - runs ONLY ONCE on mount
   */
  useEffect(() => {
    loadFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  /**
   * Setup real-time subscriptions - runs ONLY ONCE on mount
   */
  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run on mount

  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  /**
   * Wrapped setState that saves to Supabase with debouncing
   */
  const setDataWithSync = useCallback((newData) => {
    // Handle function updater pattern
    const resolvedData = typeof newData === 'function' ? newData(dataRef.current) : newData;

    // Update local state immediately
    setData(resolvedData);

    // Debounce the Supabase save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveToSupabase(resolvedData);
    }, 500);
  }, [saveToSupabase]);

  return [
    data,
    setDataWithSync,
    {
      loading,
      error,
      syncing,
      isOnline,
      refresh,
      isUsingSupabase: shouldUseSupabase && !!userIdRef.current
    }
  ];
}
