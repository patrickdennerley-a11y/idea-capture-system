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

    // 🚀 POLLING STRATEGY (Non-Conflicting)
    // If URL has #access_token, Supabase's internal client (detectSessionInUrl: true)
    // will try to auto-login. We must NOT interfere by calling setSession manually.
    // Instead, we wait and watch for the session to appear.
    const isMagicLink = window.location.hash.includes('access_token');

    // Give Supabase 8 seconds to process the token internally
    const POLL_INTERVAL = 500;
    const MAX_RETRIES = 16; // 8 seconds total

    const initAuth = async () => {
      let attempts = 0;

      const checkSession = async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();

          if (session?.user) {
            console.log('✅ Auth loaded via Polling - user found');
            if (mounted) {
              setUser(session.user);
              setIsAuthenticated(true);
              setLoading(false);
            }
            return true; // Found!
          }
          return false; // Not yet
        } catch (err) {
          console.error('Session check error:', err);
          return false;
        }
      };

      // 1. If this is a Magic Link, we enter the Polling Loop
      if (isMagicLink) {
        console.log('🔗 Magic Link detected - Starting Polling (waiting for auto-login)...');

        const pollTimer = setInterval(async () => {
          if (!mounted) {
            clearInterval(pollTimer);
            return;
          }

          const found = await checkSession();

          if (found) {
            console.log('🎉 Magic Link Login Successful!');
            clearInterval(pollTimer);
            // Clean URL to look nice
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            attempts++;
            if (attempts >= MAX_RETRIES) {
              console.warn('⚠️ Magic Link polling timed out - Auto-login failed or took too long.');
              clearInterval(pollTimer);
              if (mounted) setLoading(false); // Give up and show UI
            }
          }
        }, POLL_INTERVAL);

        return; // Exit main initAuth, let the interval handle it
      }

      // 2. Normal Load (Not a magic link) - Just check once
      await checkSession();
      if (mounted) setLoading(false);
    };

    initAuth();

    // Listen for auth changes (Backup mechanism)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth event: ${event}`);

        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
          } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
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
