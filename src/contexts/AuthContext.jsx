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

    // 🚀 SMART TIMEOUT LOGIC
    // If URL has #access_token, it's a magic link -> Wait 4s (enough for manual exchange)
    // If not, it's a normal load -> Wait only 2s
    const isMagicLink = window.location.hash.includes('access_token');
    const TIMEOUT_DURATION = isMagicLink ? 4000 : 2000;

    const initAuth = async () => {
      try {
        // 1. Manual Magic Link Handling
        // If we see tokens in the URL, we try to set the session immediately.
        // This avoids the race condition where AuthContext waits for Auth.jsx,
        // but Auth.jsx is blocked by AuthContext.
        const hash = window.location.hash;
        if (mounted && hash && hash.includes('access_token') && hash.includes('refresh_token')) {
          console.log('🔗 Magic Link/Recovery hash detected in AuthContext - processing manually...');
          try {
             // Parse the hash manually
             const params = new URLSearchParams(hash.substring(1)); // remove #
             const access_token = params.get('access_token');
             const refresh_token = params.get('refresh_token');

             if (access_token && refresh_token) {
               const { data, error } = await supabase.auth.setSession({
                 access_token,
                 refresh_token,
               });

               if (!error && data?.session?.user) {
                 console.log('✅ Manual session exchange successful');
                 setUser(data.session.user);
                 setIsAuthenticated(true);
                 setLoading(false);
                 return; // DONE! No need to run getSession below
               } else if (error) {
                 console.error('Manual session exchange failed:', error);
                 // Fall through to getSession just in case
               }
             }
          } catch (e) {
            console.error('Error parsing hash:', e);
          }
        }

        // 2. Standard Session Check (Fallback or Normal Load)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ Auth loaded - user found');
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            // Only log this if it's a magic link to keep console clean
            if (isMagicLink) console.log('⚠️ Auth loaded - no user found yet');
            setUser(null);
            setIsAuthenticated(false);
          }

          // If we found a session or it's NOT a magic link, stop loading immediately
          if (session?.user || !isMagicLink) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) setLoading(false);
      }
    };

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn(`⚠️ Auth initialization timeout (${TIMEOUT_DURATION}ms) - forcing UI load`);
        setLoading(false);
      }
    }, TIMEOUT_DURATION);

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth event: ${event}`);

        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false); // Ensure loading stops on sign in
          } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
             // Handle explicit sign out events
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  // ☢️ NUCLEAR LOGOUT FUNCTION
  const signOut = async () => {
    try {
      console.log('🚪 Sign out initiated - Clearing EVERYTHING');

      // 1. Clear React state IMMEDIATELY (Updates UI)
      setUser(null);
      setIsAuthenticated(false);

      // 2. Clear Storage (Prevents "Zombie" sessions from auto-reloading)
      localStorage.clear();
      sessionStorage.clear();

      // 3. Tell Supabase to kill the session
      await supabase.auth.signOut();

      console.log('✅ Sign out complete');

      // 4. Force reload to ensure clean state
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      // Force clear even if network fails
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
