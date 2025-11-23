import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. IMMEDIATE HASH CHECK
        // We grab the token raw from the URL before anyone else can touch it.
        const hash = window.location.hash;
        const hasToken = hash.includes('access_token') && hash.includes('refresh_token');

        if (hasToken) {
          console.log('⚡ AuthContext: Token found. Taking control.');

          // PARSE THE TOKEN MANUALLY
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          // CRITICAL: WIPE THE URL IMMEDIATELY
          // This prevents Auth.jsx or Supabase auto-detect from trying to use it again (Race Condition Killer)
          window.history.replaceState(null, '', window.location.pathname);

          if (access_token && refresh_token) {
            console.log('⚡ AuthContext: Manually exchanging token...');

            // Race condition: setSession vs Timeout
            // If Supabase hangs, we don't want to wait 15s. We give it 3s.
            const setSessionPromise = supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Manual exchange timed out')), 3000)
            );

            try {
              const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);

              if (error) {
                console.warn('⚠️ Manual exchange reported error:', error.message);
                // If manual failed (e.g. "invalid token"), it's possible Supabase auto-logic
                // beat us to it in the split second before we cleared hash.
                // So we fall through to the getSession() check below.
              } else if (data?.session?.user) {
                console.log('✅ AuthContext: Manual login successful!');
                if (mounted) {
                  setUser(data.session.user);
                  setIsAuthenticated(true);
                  setLoading(false);
                }
                return; // EARLY EXIT - SUCCESS
              }
            } catch (err) {
              console.error('⚠️ Manual exchange exception:', err);
              // Fall through to getSession check
            }
          }
        }

        // 2. STANDARD SESSION CHECK (The Fallback)
        // Checks if we are logged in (either from previous session OR if auto-logic beat us)
        console.log('🔍 AuthContext: Checking existing session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ AuthContext: Session found.');
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            console.log('❌ AuthContext: No session found.');
            setUser(null);
            setIsAuthenticated(false);
          }
          // FORCE UI TO LOAD NO MATTER WHAT
          setLoading(false);
        }
      } catch (error) {
        console.error('💥 AuthContext: Critical initialization error:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 3. EVENT LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth event: ${event}`);
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // ☢️ NUCLEAR LOGOUT
  const signOut = async () => {
    try {
      console.log('🚪 Sign out initiated');
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut, // Use our custom nuclear logout
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
