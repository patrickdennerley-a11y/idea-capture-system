import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';

export default function Auth({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(true); // Default to magic link for ADHD-friendly UX
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // CRITICAL: Initialize from localStorage in case URL hash was already cleared by Supabase
  // This ensures we show the password reset form even if the hash disappeared before mount
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    const isPending = localStorage.getItem('neural_recovery_pending') === 'true';
    if (isPending) {
      console.log('🔐 Auth.jsx initialized in recovery mode from localStorage flag');
    }
    return isPending;
  });

  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Use a ref to prevent double-processing in React StrictMode
  const processingRef = useRef(false);

  const { signUp, signIn, signInWithMagicLink, sendPasswordSetupEmail, updatePassword } = useAuth();

  // Helper: Timeout wrapper for Supabase calls to prevent infinite hanging
  const withTimeout = (promise, ms = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
    ]);
  };

  // CRITICAL: Cleanup recovery flag when component unmounts (e.g., user navigates away)
  useEffect(() => {
    return () => {
      // Only clear flag if we're not in active recovery mode
      // (prevents clearing during password update flow)
      if (!isPasswordRecovery) {
        const hasPendingFlag = localStorage.getItem('neural_recovery_pending') === 'true';
        if (hasPendingFlag) {
          console.log('🧹 Component unmounting: clearing stale recovery flag');
          localStorage.removeItem('neural_recovery_pending');
        }
      }
    };
  }, [isPasswordRecovery]);

  // CRITICAL: Clear recovery flag when user switches authentication modes
  // This prevents flag from persisting if user abandons recovery flow
  useEffect(() => {
    // If user switches away from password recovery mode, clear the flag
    if (!isPasswordRecovery && !showPasswordReset) {
      const hasPendingFlag = localStorage.getItem('neural_recovery_pending') === 'true';
      if (hasPendingFlag) {
        console.log('🧹 User exited recovery mode: clearing recovery flag');
        localStorage.removeItem('neural_recovery_pending');
      }
    }
  }, [isPasswordRecovery, showPasswordReset]);

  // Safety Timeout: Force stop loading if Supabase hangs for > 8 seconds
  useEffect(() => {
    let safetyTimer;
    if (sessionLoading) {
      safetyTimer = setTimeout(() => {
        console.warn('⚠️ Session establishment timed out. Forcing UI reset.');
        setSessionLoading(false);
        processingRef.current = false; // Release lock
        if (!isPasswordRecovery && !error) {
          setError('Connection took too long. Please reload the page and try again.');
        }
      }, 8000);
    }
    return () => clearTimeout(safetyTimer);
  }, [sessionLoading, isPasswordRecovery, error]);

  // Check if URL contains password recovery token or errors
  useEffect(() => {
    const hash = window.location.hash.substring(1);

    // CRITICAL FIX: If no hash but recovery flag is set, check for existing session
    // This handles the race condition where Supabase auto-detected the tokens,
    // established the session, and cleared the hash before this useEffect ran
    if (!hash) {
      const isRecoveryPending = localStorage.getItem('neural_recovery_pending') === 'true';
      if (isRecoveryPending) {
        console.log('⚠️ No hash found, but recovery flag is set. Checking for existing session...');

        // Check if Supabase already established a session
        const checkExistingSession = async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            console.log('✅ Session exists (auto-detected by Supabase). Showing password form.');
            setSessionLoading(false);
            setIsPasswordRecovery(true);
          } else {
            console.log('❌ No session found. Recovery link may be invalid.');
            setError('Recovery session not found. Please request a new password reset link.');
            localStorage.removeItem('neural_recovery_pending');
          }
        };

        checkExistingSession();
      }
      return;
    }

    const hashParams = new URLSearchParams(hash);
    const type = hashParams.get('type');
    const errorDescription = hashParams.get('error_description');
    const errorCode = hashParams.get('error_code');
    const accessToken = hashParams.get('access_token');

    console.log('Auth URL hash detected:', {
      type,
      hasAccessToken: !!accessToken,
      errorDescription,
      errorCode
    });

    // Handle OTP errors immediately (don't wait for timeout)
    if (errorDescription || errorCode) {
      console.error('Auth error from URL:', { errorDescription, errorCode });

      // Show appropriate error message
      if (errorDescription?.includes('expired') || errorDescription?.includes('Token')) {
        setError('Your login link has expired. Please request a new one.');
      } else {
        setError(errorDescription || 'Authentication failed. Please try again.');
      }

      // Clean up URL immediately
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check for password recovery
    // Recovery links have BOTH type=recovery AND access_token
    // We need to explicitly set the session to establish it reliably
    if (type === 'recovery' && accessToken) {
      // PREVENT DOUBLE PROCESSING (React StrictMode runs effects twice)
      if (processingRef.current) {
        console.log('Already processing recovery token, skipping duplicate');
        return;
      }
      processingRef.current = true;

      console.log('Password recovery mode detected - processing tokens...');
      setSessionLoading(true);

      // CRITICAL: Reinforce localStorage flag (App.jsx may have already set it on mount)
      // This ensures both App.jsx and Auth.jsx coordinate via the same flag
      // Supabase automatically clears the URL hash after setSession(), so this
      // persistent flag prevents App.jsx from redirecting too early
      localStorage.setItem('neural_recovery_pending', 'true');
      console.log('🔒 Reinforced neural_recovery_pending flag in localStorage');

      // Explicitly process the recovery tokens to establish the session
      const processRecoveryToken = async () => {
        try {
          console.log('Processing recovery tokens with Supabase...');

          // Get the refresh token from the URL
          const refreshToken = hashParams.get('refresh_token');

          // Auto-detect check (in case Supabase handled it before we got here)
          const { data: existingSession } = await supabase.auth.getSession();
          if (existingSession?.session) {
            console.log('✅ Session auto-detected. Proceeding.');
            setIsPasswordRecovery(true);
            return;
          }

          if (!refreshToken) {
            throw new Error('No refresh token found in URL');
          }

          // Explicitly set the session using the tokens from the URL with timeout protection
          const { data, error } = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
          );

          if (error) throw error;

          if (data.session) {
            console.log('✅ Recovery session established manually');
            setIsPasswordRecovery(true);
          } else {
            throw new Error('Session establishment returned no data');
          }
        } catch (err) {
          console.error('Recovery processing failed:', err);

          // Final fallback check
          const { data: lastCheck } = await supabase.auth.getSession();
          if (lastCheck?.session) {
            console.log('✅ Session found despite error. Proceeding.');
            setIsPasswordRecovery(true);
          } else {
            setError(`Invalid or expired recovery link: ${err.message}`);
            localStorage.removeItem('neural_recovery_pending');
            window.history.replaceState(null, '', window.location.pathname);
          }
        } finally {
          setSessionLoading(false); // CRITICAL: Always turn off spinner
          processingRef.current = false; // Release lock
        }
      };

      processRecoveryToken();

      // Don't process the rest of the auth flow
      return;
    } else if (accessToken && type !== 'recovery') {
      // PREVENT DOUBLE PROCESSING (React StrictMode runs effects twice)
      if (processingRef.current) {
        console.log('Already processing magic link, skipping duplicate');
        return;
      }
      processingRef.current = true;

      // Handle Magic Links / Signups explicitly
      // (Fixes race condition where AuthContext times out before Supabase auto-detects)
      console.log('Access token detected in URL (Magic Link) - processing...');
      setSessionLoading(true);

      const processMagicLink = async () => {
        try {
          const refreshToken = hashParams.get('refresh_token');

          // 1. Check if Supabase already handled it automatically
          const { data: existingSession } = await supabase.auth.getSession();
          if (existingSession?.session) {
            console.log('✅ Session auto-detected. Logging in...');
            window.history.replaceState(null, '', window.location.pathname);
            onAuthenticated();
            return;
          }

          // 2. Manual setSession with timeout protection
          if (refreshToken) {
            // Standard flow with refresh token
            const { data, error } = await withTimeout(
              supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              })
            );

            if (error) throw error;

            if (data.session) {
              console.log('✅ Magic link session established manually');
              window.history.replaceState(null, '', window.location.pathname);
              onAuthenticated();
            } else {
              throw new Error('Session creation failed (no session returned)');
            }
          } else {
            // Implicit flow (Access token only, no refresh token) - Verify by getting user
            console.log('⚠️ No refresh token, verifying access token (implicit flow)...');
            const { error } = await withTimeout(supabase.auth.getUser(accessToken));
            if (error) throw error;

            console.log('✅ Magic link verified (implicit flow)');
            window.history.replaceState(null, '', window.location.pathname);
            onAuthenticated();
          }
        } catch (err) {
          console.error('Magic link failed:', err);

          // Fallback check
          const { data: lastCheck } = await supabase.auth.getSession();
          if (lastCheck?.session) {
            console.log('✅ Session found despite error. Logging in...');
            window.history.replaceState(null, '', window.location.pathname);
            onAuthenticated();
          } else {
            setError('Failed to log in with magic link. Please try requesting a new one.');
            window.history.replaceState(null, '', window.location.pathname);
          }
        } finally {
          setSessionLoading(false); // CRITICAL: Always turn off spinner
          processingRef.current = false; // Release lock
        }
      };

      processMagicLink();
    }
  }, [onAuthenticated]);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await sendPasswordSetupEmail(email);
      if (result.error) {
        setError(result.error.message);
      } else {
        setMessage('Check your email for the password setup link! 📧');
        setShowPasswordReset(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // CRITICAL: Clear recovery flag when user cancels password reset/recovery
  const handleBackToLogin = () => {
    console.log('🧹 User clicked "Back to login": clearing recovery flag and returning to login');
    localStorage.removeItem('neural_recovery_pending');
    setShowPasswordReset(false);
    setIsPasswordRecovery(false);
    setMessage('');
    setError('');
  };

  // CRITICAL: Clear recovery flag when switching authentication modes
  const handleToggleAuthMode = () => {
    console.log('🔄 Switching authentication mode: clearing recovery flag');
    localStorage.removeItem('neural_recovery_pending');
    setUseMagicLink(!useMagicLink);
    setMessage('');
    setError('');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    console.log('🔐 Starting password update...');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Safety check: ensure we have a session before attempting to update password
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No session found when trying to update password');
      setError('Session expired. Please request a new password reset link.');
      setLoading(false);
      return;
    }

    console.log('Session confirmed, proceeding with password update');

    try {
      console.log('Calling updatePassword...');
      const result = await updatePassword(newPassword);
      console.log('updatePassword result:', { error: result.error, success: !result.error });

      if (result.error) {
        console.error('Password update failed:', result.error);
        setError(result.error.message);
        setLoading(false);
      } else {
        console.log('✅ Password updated successfully');
        setMessage('Password updated successfully! Redirecting...');

        // CRITICAL: Clear BOTH the URL hash AND the localStorage flag
        // This signals to App.jsx that recovery is complete and it's safe to redirect
        localStorage.removeItem('neural_recovery_pending');
        window.history.replaceState(null, '', window.location.pathname);
        console.log('🧹 URL hash and recovery flag cleared after successful password update');

        // CRITICAL FIX: Force reload to ensure App hooks initialize with new session
        // instead of calling onAuthenticated() which keeps stale hooks
        setTimeout(() => {
          console.log('🔄 Reloading page to initialize App with authenticated session');
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      console.error('Password update exception:', err);
      setError(err.message || 'Failed to update password. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // CRITICAL: Prevent double-submission with processing lock
    if (processingRef.current) {
      console.log('Form submission already in progress, ignoring duplicate');
      return;
    }
    processingRef.current = true;

    setLoading(true);
    setMessage('');
    setError('');

    let shouldReload = false;

    try {
      let result;

      if (useMagicLink) {
        // Magic link (passwordless)
        result = await signInWithMagicLink(email);
        if (!result.error) {
          setMessage('Check your email for the login link! 📧');
        }
      } else if (isSignUp) {
        // Sign up with password
        result = await signUp(email, password);

        // Log the result for debugging
        console.log('SignUp result:', {
          error: result.error,
          user: result.data?.user,
          session: result.data?.session,
          identities: result.data?.user?.identities
        });

        if (!result.error) {
          // Check if this is an existing user (identities array is empty or user already confirmed)
          const isExistingUser = result.data?.user?.identities?.length === 0 && !result.data?.session;

          if (isExistingUser) {
            // User already exists - send password setup email instead
            console.log('Existing user detected, sending password setup email');
            const setupResult = await sendPasswordSetupEmail(email);
            if (setupResult.error) {
              console.error('Password setup email error:', setupResult.error);
              setError(`Couldn't send password setup email: ${setupResult.error.message}`);
            } else {
              setMessage('Account exists! We\'ve sent you an email to set up password login. Check your inbox! 📧');
            }
          } else if (result.data?.user?.identities?.length === 0) {
            // New user, email confirmation required
            setMessage('Account created! Check your email to confirm. 📧');
          } else {
            // New user, no email confirmation required (or already logged in)
            setMessage('Account created successfully! Loading your data...');
            // Ensure we reload after signup if session is established
            if (result.data?.session) {
              console.log('✅ Signup auto-login');
              shouldReload = true;
            }
          }
        }
      } else {
        // Sign in with password
        result = await signIn(email, password);
        if (!result.error) {
          setMessage('Signed in successfully! Loading your data...');
          console.log('✅ Password login success');
          // CRITICAL FIX: Mark for reload to initialize sync hooks correctly
          shouldReload = true;
        }
      }

      if (result.error) {
        // Handle specific error cases
        if (result.error.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before signing in. Check your inbox!');
        } else if (result.error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again or use the magic link option.');
        } else if (
          result.error.message.includes('User already registered') ||
          result.error.message.includes('already been registered') ||
          result.error.message.includes('already registered') ||
          result.error.message.toLowerCase().includes('already exists')
        ) {
          // User exists but trying to set up password - send password setup email
          try {
            const setupResult = await sendPasswordSetupEmail(email);
            if (setupResult.error) {
              setError(`Account exists but couldn't send password setup email: ${setupResult.error.message}`);
            } else {
              setMessage('Account exists! We\'ve sent you an email to set up password login. Check your inbox! 📧');
            }
          } catch (err) {
            setError('An account with this email already exists. Try signing in instead, or use the magic link option.');
          }
        } else {
          setError(result.error.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      // CRITICAL FIX: If we need to reload (login success), clear recovery flags and persist session
      if (shouldReload) {
        console.log('✅ Authentication successful - Cleaning up flags and reloading');

        // CRITICAL: Clear recovery flag to prevent getting stuck in recovery mode after reload
        localStorage.removeItem('neural_recovery_pending');
        console.log('🧹 Cleared neural_recovery_pending flag before reload');

        // CRITICAL: Give Supabase time to persist session before reload (150ms)
        // This prevents race condition where reload happens before session is saved
        setTimeout(() => {
          console.log('🔄 Reloading page to initialize App with authenticated session');
          window.location.reload();
        }, 150);
      } else {
        setLoading(false);
        processingRef.current = false; // Release lock on failure
      }
    }
  };

  // If Supabase is not configured, show a message
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">🧠</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Neural Capture</h1>
            <p className="text-gray-600 mb-4">
              Supabase is not configured. Running in localStorage-only mode.
            </p>
            <button
              onClick={onAuthenticated}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Continue with Local Storage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧠</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Neural Capture</h1>
          <p className="text-gray-600">Your Personal Life OS for ADHD</p>
        </div>

        {sessionLoading ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-600">
              Establishing secure session...
            </p>
            <p className="text-sm text-gray-500">
              This will only take a moment
            </p>
          </div>
        ) : isPasswordRecovery ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Enter your new password below.
              </p>
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {message && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                {message}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                '🔐 Update Password'
              )}
            </button>
          </form>
        ) : showPasswordReset ? (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Enter your email to receive a link to set up or reset your password.
              </p>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {message && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                {message}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                '📧 Send Password Setup Email'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ← Back to login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>

            {!useMagicLink && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!useMagicLink}
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

          {message && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : useMagicLink ? (
              '✨ Send Magic Link'
            ) : isSignUp ? (
              '🚀 Create Account'
            ) : (
              '🔐 Sign In'
            )}
          </button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={handleToggleAuthMode}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                {useMagicLink ? 'Use password instead' : 'Use magic link (recommended)'}
              </button>

              {!useMagicLink && (
                <div className="space-y-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordReset(true)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Forgot password or need to set one?
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Your data is encrypted and private. Works offline and syncs across devices.
          </p>
        </div>
      </div>
    </div>
  );
}
