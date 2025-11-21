import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../utils/supabaseClient';

export default function Auth({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(true); // Default to magic link for ADHD-friendly UX
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { signUp, signIn, signInWithMagicLink } = useAuth();

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
        if (!result.error) {
          setMessage('Account created! Check your email to confirm. 📧');
        }
      } else {
        // Sign in with password
        result = await signIn(email, password);
        if (!result.error && onAuthenticated) {
          onAuthenticated();
        }
      }

      if (result.error) {
        setError(result.error.message);
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
              <div>
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            )}
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Your data is encrypted and private. Works offline and syncs across devices.
          </p>
        </div>
      </div>
    </div>
  );
}
