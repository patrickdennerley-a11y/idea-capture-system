import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, UserPlus } from 'lucide-react'

export default function Auth({ onAuthSuccess }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { login, signup, enterGuestMode } = useAuth()

  const handleGuestMode = () => {
    // Use context function to update state immediately
    enterGuestMode()
    // Navigation will happen automatically via route guards
    navigate('/dashboard')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
        if (onAuthSuccess) onAuthSuccess()
      } else {
        const data = await signup(email, password)
        // Check if email confirmation is required
        if (data.session === null) {
          // Email confirmation required - show confirmation message
          setShowConfirmation(true)
        } else {
          // No confirmation needed (e.g., email confirmation disabled)
          alert('Signup successful! You can now login.')
          setMode('login')
          setPassword('')
        }
      }
    } catch (error) {
      setError(error.message)
      alert(`${mode === 'login' ? 'Login' : 'Signup'} failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neural-darker p-4">
      <div className="w-full max-w-md">
        <div className="bg-neural-dark rounded-2xl shadow-xl border border-gray-800 p-8 relative">
          {/* Guest Mode Button - Top Right */}
          <button
            onClick={handleGuestMode}
            className="absolute top-4 right-4 text-xs text-gray-400 hover:text-gray-200 transition-colors underline"
          >
            Continue without account
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Neural Capture</h1>
            <p className="text-gray-400">Your Personal Life OS</p>
          </div>

          {/* Show confirmation message if signup requires email verification */}
          {showConfirmation ? (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-400 mb-2">Confirmation Email Sent</h3>
                <p className="text-gray-300 mb-4">
                  Please check your inbox at <span className="font-medium text-white">{email}</span> and click the confirmation link to activate your account.
                </p>
                <p className="text-sm text-gray-400">
                  After confirming, return here to log in.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowConfirmation(false)
                  setMode('login')
                  setPassword('')
                }}
                className="w-full py-3 rounded-lg font-medium bg-neural-purple text-white hover:bg-opacity-90 transition-all"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="flex gap-2 mb-6 bg-neural-darker rounded-lg p-1">
                <button
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                    mode === 'login'
                      ? 'bg-neural-purple text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
                <button
                  onClick={() => {
                    setMode('signup')
                    setError('')
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                    mode === 'signup'
                      ? 'bg-neural-purple text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  Sign Up
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-neural-darker border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neural-purple focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2 bg-neural-darker border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-neural-purple focus:border-transparent"
                placeholder="••••••••"
              />
              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-neural-purple hover:underline"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                loading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-neural-purple to-neural-pink text-white hover:shadow-lg hover:scale-[1.02]'
              }`}
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

              {/* Footer Info */}
          <div className="mt-6 text-center text-sm text-gray-400">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup')
                    setError('')
                  }}
                  className="text-neural-purple hover:underline"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                  className="text-neural-purple hover:underline"
                >
                  Login
                </button>
              </p>
            )}
              </div>
            </>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Your data is securely stored and encrypted</p>
        </div>
      </div>
    </div>
  )
}
