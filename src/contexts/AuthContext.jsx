import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Manual token parsing for email confirmation flow
    // Since detectSessionInUrl is false, we must parse the hash ourselves
    const handleEmailConfirmation = async () => {
      const hash = window.location.hash
      
      if (hash && hash.includes('access_token')) {
        try {
          // Parse the hash parameters
          const hashParams = new URLSearchParams(hash.substring(1)) // Remove '#' and parse
          const access_token = hashParams.get('access_token')
          const refresh_token = hashParams.get('refresh_token')
          const type = hashParams.get('type')
          
          // Check if this is a signup or recovery confirmation
          if (access_token && refresh_token && (type === 'signup' || type === 'recovery')) {
            // Set the session manually
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            })
            
            if (error) {
              console.error('Error setting session from email link:', error)
            } else if (data.session) {
              // Successfully set session
              setUser(data.session.user)
              // Clean up the URL hash
              window.history.replaceState(null, '', window.location.pathname)
              setLoading(false)
              return // Exit early, session is set
            }
          }
        } catch (error) {
          console.error('Error parsing email confirmation hash:', error)
        }
      }
    }

    // Try to handle email confirmation first
    handleEmailConfirmation().then(() => {
      // Then check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })
    })

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
