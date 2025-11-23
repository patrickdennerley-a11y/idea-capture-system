import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Check if we are coming back from a Magic Link
        const hash = window.location.hash;

        // Only process if we see an access token and we haven't processed it yet
        if (hash && hash.includes('access_token')) {
          console.log('🔗 Magic Link detected. Processing manually...');

          // Parse the hash
          const params = new URLSearchParams(hash.substring(1)); // remove the '#'
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          // Clean the URL immediately so we don't try to use it again
          window.history.replaceState(null, '', window.location.pathname);

          if (access_token && refresh_token) {
            // Manually set the session
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) {
              console.error('❌ Error exchanging token:', error.message);
            } else if (data.session) {
              console.log('✅ Session established via Magic Link');
              if (mounted) {
                setUser(data.session.user);
                setIsAuthenticated(true);
                setLoading(false);
              }
              return; // We are done, don't run the standard check
            }
          }
        }

        // 2. Standard Session Check (for normal page loads)
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ Existing session found');
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            console.log('ℹ️ No active session');
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('💥 Auth Initialization Error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // 3. Listen for future auth changes (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          console.log(`🔔 Auth State Changed: ${event}`);
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear(); // Clean up specific keys if needed, but strict clear is safer
      window.location.href = '/';
    },
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="min-h-screen bg-neural-darker flex items-center justify-center">
           <div className="text-center">
             <div className="text-6xl mb-4 animate-bounce">🧠</div>
             <p className="text-gray-400">Loading Neural Capture...</p>
           </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;
