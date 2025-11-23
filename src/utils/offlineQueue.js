import { supabase, getCurrentUser, isSupabaseConfigured } from './supabaseClient';

/**
 * Offline queue manager for handling data sync when coming back online
 */

const QUEUE_KEY = 'neural-offline-queue';
const SYNC_STATUS_KEY = 'neural-sync-status';

/**
 * Queue operation types
 */
export const OperationType = {
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  UPSERT: 'UPSERT'
};

/**
 * Get offline queue from localStorage
 */
const getQueue = () => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading offline queue:', error);
    return [];
  }
};

/**
 * Save queue to localStorage
 */
const saveQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving offline queue:', error);
  }
};

/**
 * Get sync status
 */
export const getSyncStatus = () => {
  try {
    const status = localStorage.getItem(SYNC_STATUS_KEY);
    return status ? JSON.parse(status) : { lastSync: null, pending: 0 };
  } catch (error) {
    console.error('Error reading sync status:', error);
    return { lastSync: null, pending: 0 };
  }
};

/**
 * Update sync status
 */
const setSyncStatus = (status) => {
  try {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
  } catch (error) {
    console.error('Error saving sync status:', error);
  }
};

/**
 * Add operation to offline queue
 */
export const queueOperation = (tableName, operation, data) => {
  const queue = getQueue();
  const queueItem = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tableName,
    operation,
    data,
    timestamp: new Date().toISOString(),
    retries: 0
  };

  queue.push(queueItem);
  saveQueue(queue);

  // Update sync status
  const status = getSyncStatus();
  setSyncStatus({ ...status, pending: queue.length });

  return queueItem.id;
};

/**
 * Execute a single queue item
 */
const executeQueueItem = async (item, userId) => {
  const { tableName, operation, data } = item;

  try {
    let result;

    // Add user_id to data if not present
    const dataWithUserId = Array.isArray(data)
      ? data.map(d => ({ ...d, user_id: userId }))
      : { ...data, user_id: userId };

    switch (operation) {
      case OperationType.INSERT:
        result = await supabase
          .from(tableName)
          .insert(dataWithUserId);
        break;

      case OperationType.UPDATE:
        if (Array.isArray(dataWithUserId)) {
          // Batch update
          for (const item of dataWithUserId) {
            const { id, ...updateData } = item;
            await supabase
              .from(tableName)
              .update(updateData)
              .eq('id', id)
              .eq('user_id', userId);
          }
          result = { error: null };
        } else {
          const { id, ...updateData } = dataWithUserId;
          result = await supabase
            .from(tableName)
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId);
        }
        break;

      case OperationType.DELETE:
        const ids = Array.isArray(data) ? data : [data];
        result = await supabase
          .from(tableName)
          .delete()
          .in('id', ids)
          .eq('user_id', userId);
        break;

      case OperationType.UPSERT:
        result = await supabase
          .from(tableName)
          .upsert(dataWithUserId, { onConflict: 'id' });
        break;

      default:
        throw new Error(`Unknown operation type: ${operation}`);
    }

    if (result.error) throw result.error;

    return { success: true };
  } catch (error) {
    console.error(`Error executing queue item:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Process offline queue
 */
export const processQueue = async (onProgress) => {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping queue processing');
    return { success: false, error: 'Supabase not configured' };
  }

  if (!navigator.onLine) {
    console.log('Device is offline, skipping queue processing');
    return { success: false, error: 'Device is offline' };
  }

  try {
    // Add 10-second timeout to getCurrentUser to prevent hanging (increased from 5s)
    const getUserWithTimeout = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('User check timeout')), 10000)
      );
      return Promise.race([getCurrentUser(), timeoutPromise]);
    };

    let user;
    try {
      user = await getUserWithTimeout();
    } catch (err) {
      console.error('❌ getCurrentUser timeout:', err);
      return { success: false, error: 'User authentication timeout' };
    }

    if (!user) {
      console.log('User not authenticated, skipping queue processing');
      return { success: false, error: 'User not authenticated' };
    }

    const queue = getQueue();
    if (queue.length === 0) {
      console.log('Queue is empty, nothing to sync');
      return { success: true, processed: 0 };
    }

    console.log(`Processing ${queue.length} queued operations...`);

    let processed = 0;
    let failed = 0;
    const failedItems = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      // Call progress callback if provided
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: queue.length,
          item: item.tableName
        });
      }

      const result = await executeQueueItem(item, user.id);

      if (result.success) {
        processed++;
      } else {
        failed++;
        item.retries = (item.retries || 0) + 1;
        item.lastError = result.error;

        // Keep failed items in queue if retries < 3
        if (item.retries < 3) {
          failedItems.push(item);
        } else {
          console.error(`Queue item failed after 3 retries:`, item);
        }
      }
    }

    // Update queue with only failed items (that haven't exceeded retry limit)
    saveQueue(failedItems);

    // Update sync status
    setSyncStatus({
      lastSync: new Date().toISOString(),
      pending: failedItems.length,
      lastSyncResult: {
        processed,
        failed,
        total: queue.length
      }
    });

    console.log(`Queue processing complete: ${processed} succeeded, ${failed} failed`);

    return {
      success: true,
      processed,
      failed,
      total: queue.length
    };
  } catch (error) {
    console.error('Error processing queue:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear all pending operations
 */
export const clearQueue = () => {
  saveQueue([]);
  setSyncStatus({ lastSync: null, pending: 0 });
};

/**
 * Get queue size
 */
export const getQueueSize = () => {
  return getQueue().length;
};

/**
 * Check if there are pending operations
 */
export const hasPendingOperations = () => {
  return getQueue().length > 0;
};
