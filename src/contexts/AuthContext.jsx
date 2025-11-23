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
    // Handle magic link tokens in URL if present
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      // Clean up URL immediately
      window.history.replaceState(null, '', window.location.pathname);

      if (access_token && refresh_token) {
        // Set session - don't await, let onAuthStateChange handle it
        supabase.auth.setSession({
          access_token,
          refresh_token
        });
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    // Listen to auth changes - this is the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut,
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neural-darker flex items-center justify-center flex-col">
        <div className="text-6xl mb-4 animate-bounce">🧠</div>
        <p className="text-gray-400 font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
