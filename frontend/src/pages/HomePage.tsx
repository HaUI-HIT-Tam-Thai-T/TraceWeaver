import { AuthStatus } from '../features/auth/AuthStatus'

export function HomePage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-bold">TraceWeaver</h1>
      <AuthStatus />
    </>
  )
}
