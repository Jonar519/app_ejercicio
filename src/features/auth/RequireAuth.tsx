import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../../components/Loading';
import { useAuthStore } from './authStore';

export function RequireAuth() {
  const location = useLocation();
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);
  const recovery = useAuthStore((state) => state.recovery);

  if (status === 'loading') return <Loading />;
  if (recovery) return <Navigate to="/restablecer" replace />;
  if (!session)
    return <Navigate to="/iniciar-sesion" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const status = useAuthStore((state) => state.status);
  const session = useAuthStore((state) => state.session);

  if (status === 'loading') return <Loading />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}
