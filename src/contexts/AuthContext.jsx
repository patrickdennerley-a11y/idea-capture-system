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
          setLoadingMessage('Validating Token (Raw API)...');

          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const expires_in = params.get('expires_in');

          // Clear URL immediately
          window.history.replaceState(null, '', window.location.pathname);

          if (access_token && refresh_token) {
            // RAW API FALLBACK - Bypassing the broken SDK completely
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            try {
              // 1. Fetch User Details via standard HTTP
              // We use the token to ask Supabase "Who is this?" directly.
              const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
                headers: {
                  'Authorization': `Bearer ${access_token}`,
                  'apikey': supabaseKey
                }
              });

              if (!response.ok) {
                 throw new Error(`User fetch failed: ${response.statusText}`);
              }

              const userData = await response.json();
              console.log('✅ Raw API: User verified.');

              // 2. Manually construct the session object
              // This is exactly what Supabase expects to find in LocalStorage
              const timeNow = Math.floor(Date.now() / 1000);
              const expiresAt = timeNow + (parseInt(expires_in) || 3600);

              const sessionObj = {
                access_token,
                refresh_token,
                expires_in: parseInt(expires_in) || 3600,
                expires_at: expiresAt,
                token_type: 'bearer',
                user: userData
              };

              // 3. Inject directly into LocalStorage
              // "neural-auth-token" MUST match the key in utils/supabaseClient.js
              localStorage.setItem('neural-auth-token', JSON.stringify(sessionObj));

              console.log('💉 Session injected manually. Reloading...');

              // 4. Hard Reload to wake up the app with the new session
              window.location.reload();
              return;

            } catch (err) {
              console.error('💥 Raw API Login Error:', err);
              // Only now do we fall back to checking if the SDK picked it up by miracle
            }
          }
        }

        // 5. Standard Session Check (Runs on normal load or after reload)
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            console.log('✅ AuthContext: Session active.');
            setUser(session.user);
            setIsAuthenticated(true);
            setLoading(false);
          } else {
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

    // Event Listener for normal lifecycle events
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
