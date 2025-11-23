import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// Timeout wrapper utility for auth operations
const withTimeout = (promise, timeoutMs = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Check for auth URL parameters on mount
  useEffect(() => {
    const checkAuthUrl = async () => {
      const hash = window.location.hash;

      if (!hash || !hash.includes('access_token')) {
        console.log('No auth hash detected');
        return;
      }

      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const errorDescription = hashParams.get('error_description');
      const errorCode = hashParams.get('error_code');

      console.log('Auth URL hash detected:', {
        type,
        hasAccessToken: !!accessToken,
        errorDescription,
        errorCode
      });

      // Check if this is a password recovery link
      const isRecovery = type === 'recovery' || localStorage.getItem('neural_recovery_pending') === 'true';

      if (isRecovery) {
        console.log('Password recovery mode detected - processing tokens...');
        setSessionLoading(true);
        setShowPasswordReset(true);

        try {
          // Use 12-second timeout for recovery operations
          await withTimeout(
            (async () => {
              console.log('Processing recovery tokens with Supabase...');

              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                console.error('Recovery session error:', error);
                throw error;
              }

              if (data.session) {
                console.log('✅ Recovery session established manually');
                localStorage.removeItem('neural_recovery_pending');
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            })(),
            12000 // 12 seconds for recovery
          );
        } catch (err) {
          console.error('Recovery flow error:', err);
          setError('Failed to process password recovery link. Please request a new one.');
          localStorage.removeItem('neural_recovery_pending');
          setShowPasswordReset(false);
        } finally {
          setSessionLoading(false);
        }

        return;
      }

      // Handle magic link authentication
      if (type === 'magiclink') {
        console.log('Access token detected in URL (Magic Link) - processing...');
        setSessionLoading(true);

        try {
          // Clear any recovery flags for magic links
          localStorage.removeItem('neural_recovery_pending');

          // Use 5-second timeout for magic link operations
          await withTimeout(
            (async () => {
              console.log('Setting magic link session...');

              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (error) {
                console.error('Magic link session error:', error);
                throw error;
              }

              if (data.session) {
                console.log('✅ Magic link session established manually');
                window.history.replaceState({}, document.title, window.location.pathname);
                navigate('/');
              }
            })(),
            5000 // 5 seconds for magic link
          );
        } catch (err) {
          console.error('Magic link flow error:', err);

          // Try to check if session exists anyway
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              console.log('✅ Session auto-detected. Logging in...');
              window.history.replaceState({}, document.title, window.location.pathname);
              navigate('/');
              return;
            }
          } catch (checkErr) {
            console.error('Session check error:', checkErr);
          }

          setError('Failed to process magic link. Please try again or use password login.');
        } finally {
          setSessionLoading(false);
        }

        return;
      }

      // Handle other auth types or errors
      if (errorDescription) {
        console.error('Auth URL error:', errorDescription);
        setError(errorDescription);
      }
    };

    checkAuthUrl();
  }, [navigate]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user && !sessionLoading && !showPasswordReset) {
      navigate('/');
    }
  }, [isAuthenticated, user, navigate, sessionLoading, showPasswordReset]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (useMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setMessage('Check your email for the magic link!');
        setEmail('');
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        setMessage('Check your email to confirm your account!');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setMessage('Password updated successfully!');
      localStorage.removeItem('neural_recovery_pending');

      // Wait a moment then navigate
      setTimeout(() => {
        setShowPasswordReset(false);
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setMessage('Check your email for the password reset link!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner during session establishment
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Establishing secure session...</p>
        </div>
      </div>
    );
  }

  // Show password reset form if in recovery mode
  if (showPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset Your Password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your new password below
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handlePasswordReset}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="new-password" className="sr-only">
                  New Password
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="New Password"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {message && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">{message}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Show standard login/signup form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                disabled={loading}
              />
            </div>
            {!useMagicLink && (
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {!useMagicLink && isLogin && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-blue-600 hover:text-blue-500"
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="magic-link"
                name="magic-link"
                type="checkbox"
                checked={useMagicLink}
                onChange={(e) => setUseMagicLink(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="magic-link" className="ml-2 block text-sm text-gray-900">
                Use magic link (passwordless)
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Processing...'
                : useMagicLink
                ? 'Send magic link'
                : isLogin
                ? 'Sign in'
                : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setMessage('');
              }}
              className="font-medium text-blue-600 hover:text-blue-500"
              disabled={loading}
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
