import { createContext, useContext } from 'react'
import type { AuthSession, AuthState } from './session'

type AuthContextValue = Pick<AuthSession, 'signIn' | 'signOut' | 'getAccessToken'> & {
  state: AuthState
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
