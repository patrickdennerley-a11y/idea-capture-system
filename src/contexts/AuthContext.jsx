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

    // Initialize auth state
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (error) {
            console.error('Error getting session:', error);
          }

          if (session?.user) {
            console.log('Auth loaded - user:', !!session.user);
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            console.log('Auth loaded - user:', false);
            setUser(null);
            setIsAuthenticated(false);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // CRITICAL FIX: Increased timeout from 3000ms to 10000ms
    // This gives magic links enough time to complete processing
    // Magic links need 5-10 seconds to establish session
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ Auth initialization timeout - continuing without session');
        setLoading(false);
      }
    }, 20000); // 20 seconds safety net - INCREASED FROM 3000 -> 10000 -> 20000

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            console.log('Setting isAuthenticated: true');
          } else {
            setUser(null);
            setIsAuthenticated(false);
            console.log('Setting isAuthenticated: false');
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
