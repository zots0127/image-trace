/**
 * ProtectedRoute — pass-through wrapper.
 * Local desktop app has no auth; all routes are accessible.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
