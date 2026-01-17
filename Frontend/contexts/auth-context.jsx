"use client"

import { createContext, useContext, useEffect, useState } from "react"

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on mount
    const token = sessionStorage.getItem("auth_token")
    if (token) {
      // In a real app, validate token with backend
      // For now, we'll simulate a logged-in user
      setUser({ id: "1", email: "user@example.com", name: "Demo User" })
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // In a real app, this would be a JWT token from your FastAPI backend
      const mockToken = "mock_jwt_token"
      sessionStorage.setItem("auth_token", mockToken)

      setUser({ id: "1", email, name: "Demo User" })
    } catch (error) {
      throw new Error("Login failed")
    } finally {
      setLoading(false)
    }
  }

  const signup = async (email, password, name) => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const mockToken = "mock_jwt_token"
      sessionStorage.setItem("auth_token", mockToken)

      setUser({ id: "1", email, name: name || "Demo User" })
    } catch (error) {
      throw new Error("Signup failed")
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    sessionStorage.removeItem("auth_token")
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, signup, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
