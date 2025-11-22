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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Use a ref to prevent double-processing in React StrictMode
  const processingRef = useRef(false);

  const { signUp, signIn, signInWithMagicLink, sendPasswordSetupEmail, updatePassword } = useAuth();

  // Check if URL contains password recovery token or errors
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

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

      // Explicitly process the recovery tokens to establish the session
      const processRecoveryToken = async () => {
        try {
          console.log('Processing recovery tokens with Supabase...');

          // Get the refresh token from the URL
          const refreshToken = hashParams.get('refresh_token');

          if (!refreshToken) {
            console.error('No refresh_token found in URL');
            setError('Invalid recovery link format. Please request a new password reset.');
            setSessionLoading(false);
            // Clean up URL only on error
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          // Explicitly set the session using the tokens from the URL
          // This is more reliable than waiting for auto-detection
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Failed to set session from recovery tokens:', error);
            setError(`Invalid or expired recovery link: ${error.message}`);
            setSessionLoading(false);
            // Clean up URL only on error
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          if (data.session) {
            console.log('✅ Recovery session established successfully');
            console.log('Session user:', data.session.user.email);
            setSessionLoading(false);
            setIsPasswordRecovery(true);

            // CRITICAL FIX: Do NOT clear the URL hash here!
            // App.jsx needs the type=recovery hash to keep this component mounted
            // We'll clear it AFTER the password is successfully updated
            console.log('⚠️ Keeping URL hash to prevent premature redirect');
          } else {
            console.error('No session returned after setSession');
            setError('Could not establish session. Please request a new password reset link.');
            setSessionLoading(false);
            // Clean up URL only on error
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Error processing recovery token:', err);
          setError(`An error occurred: ${err.message}`);
          setSessionLoading(false);
          // Clean up URL only on error
          window.history.replaceState(null, '', window.location.pathname);
        }
      };

      processRecoveryToken();

      // Don't process the rest of the auth flow
      return;
    } else if (accessToken && type !== 'recovery') {
      // If we have an access token but it's not recovery (e.g., magic link),
      // Supabase will handle it via detectSessionInUrl
      console.log('Access token detected in URL - Supabase will process it');
    }
  }, []);

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
      } else {
        console.log('✅ Password updated successfully');
        setMessage('Password updated successfully! You can now sign in with your new password.');
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        // Exit recovery mode after short delay
        setTimeout(() => {
          setIsPasswordRecovery(false);
          setNewPassword('');
          setConfirmPassword('');
          setUseMagicLink(false); // Switch to password login
        }, 2000);
      }
    } catch (err) {
      console.error('Password update exception:', err);
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      console.log('Password update complete, setting loading to false');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

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
            setMessage('Account created successfully!');
          }
        }
      } else {
        // Sign in with password
        result = await signIn(email, password);
        if (!result.error) {
          // Don't call onAuthenticated manually - let AuthContext handle it
          // The auth state change listener will update the user state
          setMessage('Signed in successfully!');
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
      setLoading(false);
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
                onClick={() => setShowPasswordReset(false)}
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
                onClick={() => setUseMagicLink(!useMagicLink)}
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
