import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, onAuthStateChange, getCurrentUser, isSupabaseConfigured } from '../utils/supabaseClient';

const AuthContext = createContext({});

// NUCLEAR CLEANUP: Clear ALL auth-related state
// This ensures every auth event starts with a clean slate
export const clearAllAuthState = () => {
  console.log('🧹 NUCLEAR CLEANUP - Clearing all auth state');
  localStorage.removeItem('neural_recovery_pending');
  localStorage.removeItem('sync_in_progress');
  sessionStorage.clear();
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, running in localStorage-only mode');
      setLoading(false);
      return;
    }

    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth - checking for session...');

        // CRITICAL FIX: Check for magic link/recovery tokens in URL FIRST
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && refreshToken) {
          console.log('Auth URL hash detected:', { type });

          if (type === 'magiclink') {
            console.log('Access token detected in URL (Magic Link) - processing...');

            // CRITICAL: Await setSession to ensure it persists before continuing
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              console.error('Failed to set magic link session:', sessionError);
              // Fall through to normal session check
            } else if (sessionData?.session?.user) {
              console.log('✅ Magic link session established:', sessionData.session.user.email);

              if (mounted) {
                setSession(sessionData.session);
                setUser(sessionData.session.user);
                setLoading(false);
              }

              // Clean URL hash
              window.history.replaceState(null, '', window.location.pathname);
              return; // SUCCESS - don't continue to normal session check
            }
          } else if (type === 'recovery') {
            // Password recovery - don't auto-process, let Auth.jsx handle it
            console.log('Password recovery detected in URL - deferring to Auth component');
            // Mark as pending for Auth.jsx to process
            localStorage.setItem('neural_recovery_pending', 'true');
          }
        }

        // Normal session check (only if no magic link or magic link failed)
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        console.log('Initial session check:', {
          hasSession: !!initialSession,
          hasUser: !!initialSession?.user,
          email: initialSession?.user?.email,
          error
        });

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set timeout as safety net to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timeout - continuing without session');
        setLoading(false);
      }
    }, 3000); // 3 second timeout - faster UX

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', {
        event,
        email: session?.user?.email,
        hasSession: !!session,
        timestamp: new Date().toISOString()
      });

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log successful magic link login
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User successfully signed in via', event);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { data, error };
    },
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    },
    signInWithMagicLink: async (email) => {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      return { data, error };
    },
    signOut: async () => {
      console.log('🧹 Signing out: clearing all auth state');

      // Clear all auth-related flags
      localStorage.removeItem('neural_recovery_pending');
      localStorage.removeItem('sync_in_progress');

      try {
        const { error } = await supabase.auth.signOut();

        if (error) {
          console.error('❌ Sign out error:', error);
          return { error };
        }

        console.log('✅ Supabase sign out successful');
        return { error: null };
      } catch (error) {
        console.error('💥 Sign out exception:', error);
        return { error };
      }
    },
    sendPasswordSetupEmail: async (email) => {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });
      return { data, error };
    },
    updatePassword: async (newPassword) => {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      return { data, error };
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
