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
          setLoadingMessage('Finalizing Secure Login...');

          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          // Wipe URL immediately to prevent re-use
          window.history.replaceState(null, '', window.location.pathname);

          if (access_token && refresh_token) {
            console.log('⚡ AuthContext: Exchanging tokens...');

            // WORKAROUND FOR SUPABASE BUG #1441
            // setSession() sometimes hangs indefinitely even after success.
            // We race it against a short timeout. If it times out, we assume it
            // worked and verify via getSession().
            try {
              const setSessionPromise = supabase.auth.setSession({
                access_token,
                refresh_token
              });

              // Give it 2 seconds to be polite
              await Promise.race([
                setSessionPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('HangingPromise')), 2000))
              ]);

            } catch (err) {
              if (err.message === 'HangingPromise') {
                console.log('⚠️ AuthContext: setSession hung (known bug). Checking session anyway...');
              } else {
                console.error('💥 AuthContext Error:', err);
              }
            }

            // IMMEDIATELY CHECK SESSION
            // Even if the promise above hung, the session is likely set in memory/storage now.
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user) {
              console.log('✅ AuthContext: Login verified via getSession!');
              if (mounted) {
                setUser(data.session.user);
                setIsAuthenticated(true);
                setLoading(false);
                return; // SUCCESS
              }
            } else {
               console.warn('❌ AuthContext: Login failed verification.');
               // Fall through to normal load
            }
          }
        }

        // 2. Normal Load / Fallback
        console.log('🔍 AuthContext: Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ AuthContext: Session found.');
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
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
