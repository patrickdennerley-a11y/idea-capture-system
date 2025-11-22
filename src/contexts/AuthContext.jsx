import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, onAuthStateChange, getCurrentUser, isSupabaseConfigured } from '../utils/supabaseClient';

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
      const { error } = await supabase.auth.signOut();
      return { error };
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
