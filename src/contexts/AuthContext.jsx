import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
// 1. IMPORT CREATECLIENT DIRECTLY
import { createClient } from '@supabase/supabase-js';

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
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Check for Magic Link
        const hash = window.location.hash;
        const hasToken = hash.includes('access_token') && hash.includes('refresh_token');

        if (hasToken) {
          console.log('⚡ AuthContext: Magic Link detected.');
          setLoadingMessage('Securing Session...');

          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          // Clean URL immediately
          window.history.replaceState(null, '', window.location.pathname);

          if (access_token && refresh_token) {
            console.log('⚡ AuthContext: Bypassing main client with Fresh Client Injection...');

            // 2. THE FRESH CLIENT INJECTION
            // The main 'supabase' client is deadlocking. We create a fresh, temporary instance
            // solely to handle this handshake. It has no baggage.
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const tempClient = createClient(supabaseUrl, supabaseKey, {
              auth: {
                storage: window.localStorage,
                storageKey: 'neural-auth-token', // MUST match your main client config
                persistSession: true,
                detectSessionInUrl: false
              }
            });

            try {
              // Force the session into storage using the fresh client
              const { data, error } = await tempClient.auth.setSession({
                access_token,
                refresh_token
              });

              if (error) throw error;

              if (data?.session) {
                console.log('✅ Fresh Client: Session secured in LocalStorage.');
                console.log('🔄 Reloading to apply session...');
                // 3. HARD RELOAD
                // We reload the page. The main app will wake up, read the LocalStorage
                // we just wrote, and log in instantly as if nothing happened.
                window.location.reload();
                return;
              }
            } catch (err) {
              console.error('💥 Fresh Client Error:', err);
              // If even the fresh client fails, we are likely offline or credentials are bad.
              // We fall through to normal loading to at least show the login screen.
            }
          }
        }

        // 2. Normal Load (Or after the reload)
        // Checks if the session exists in storage (which we just wrote above if magic link)
        console.log('🔍 AuthContext: Reading storage...');
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ AuthContext: Session active.');
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
          } else {
            console.log('ℹ️ AuthContext: No session found.');
            setUser(null);
            setIsAuthenticated(false);
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Event Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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

  const signOut = async () => {
    try {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear();
      sessionStorage.clear();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
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
    signOut,
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
  };

  // If loading, show the spinner
  if (loading) {
     return (
       <div className="min-h-screen bg-neural-darker flex items-center justify-center flex-col">
         <div className="text-6xl mb-4 animate-bounce">🧠</div>
         <p className="text-gray-400 font-medium">{loadingMessage}</p>
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
