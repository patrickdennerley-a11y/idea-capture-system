import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      })

      if (error) throw error

      setEmailSent(true)
    } catch (error) {
      setError(error.message)
      console.error('Password reset error:', error)
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
            <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
            <p className="text-gray-400">
              {emailSent 
                ? 'Check your email' 
                : 'Enter your email to receive a reset link'
              }
            </p>
          </div>

          {emailSent ? (
            <div className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-6 text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-green-400 mb-2">Reset Link Sent</h3>
                <p className="text-gray-300 mb-4">
                  Please check your inbox at <span className="font-medium text-white">{email}</span> for a password reset link.
                </p>
                <p className="text-sm text-gray-400">
                  The link will expire in 1 hour.
                </p>
              </div>
              <Link
                to="/auth"
                className="block w-full py-3 rounded-lg font-medium bg-neural-purple text-white text-center hover:bg-opacity-90 transition-all"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
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
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6">
                <Link
                  to="/auth"
                  className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
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
