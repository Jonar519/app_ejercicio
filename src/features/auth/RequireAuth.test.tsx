import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { GuestOnly, RequireAuth } from './RequireAuth';

const session = { user: { id: 'usuario' } } as Session;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/perfil" element={<p>Privado</p>} />
        </Route>
        <Route element={<GuestOnly />}>
          <Route path="/iniciar-sesion" element={<p>Pantalla de acceso</p>} />
        </Route>
        <Route path="/restablecer" element={<p>Pantalla de restablecer</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('rutas protegidas', () => {
  it('espera a conocer la sesión', () => {
    useAuthStore.setState({ status: 'loading', session: null, recovery: false });
    renderAt('/perfil');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(screen.queryByText('Privado')).not.toBeInTheDocument();
  });

  it('sin sesión redirige al login', () => {
    useAuthStore.setState({ status: 'ready', session: null, recovery: false });
    renderAt('/perfil');
    expect(screen.getByText('Pantalla de acceso')).toBeInTheDocument();
    expect(screen.queryByText('Privado')).not.toBeInTheDocument();
  });

  it('con sesión permite el acceso', () => {
    useAuthStore.setState({ status: 'ready', session, recovery: false });
    renderAt('/perfil');
    expect(screen.getByText('Privado')).toBeInTheDocument();
  });

  it('una sesión de recuperación solo puede cambiar la contraseña', () => {
    useAuthStore.setState({ status: 'ready', session, recovery: true });
    renderAt('/perfil');
    expect(screen.getByText('Pantalla de restablecer')).toBeInTheDocument();
  });

  it('con sesión, el login redirige al inicio', () => {
    useAuthStore.setState({ status: 'ready', session, recovery: false });
    renderAt('/iniciar-sesion');
    expect(screen.getByText('Inicio')).toBeInTheDocument();
  });
});
