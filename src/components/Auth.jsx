import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, UserPlus } from 'lucide-react'

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(email, password)
        if (onAuthSuccess) onAuthSuccess()
      } else {
        await signup(email, password)
        alert('Signup successful! You can now login.')
        setMode('login')
        setPassword('')
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
        <div className="bg-neural-dark rounded-2xl shadow-xl border border-gray-800 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Neural Capture</h1>
            <p className="text-gray-400">Your Personal Life OS</p>
          </div>

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
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>Your data is securely stored and encrypted</p>
        </div>
      </div>
    </div>
  )
}
