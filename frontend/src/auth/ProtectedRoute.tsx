import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ gmOnly = false }: { gmOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (gmOnly && user.role !== 'GM' && user.role !== 'VICE_GM') return <Navigate to="/admin" replace />;

  return <Outlet />;
}
