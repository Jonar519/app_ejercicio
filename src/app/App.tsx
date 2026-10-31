import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RecoverPage } from '../features/auth/RecoverPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from '../features/auth/RequireAuth';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { NutritionPlaceholderPage } from '../features/nutrition/NutritionPlaceholderPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { WorkoutPlaceholderPage } from '../features/workout/WorkoutPlaceholderPage';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';
import { queryClient } from './queryClient';

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/iniciar-sesion" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/recuperar" element={<RecoverPage />} />
            </Route>
            <Route path="/restablecer" element={<ResetPasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/entrenamiento" replace />} />
                <Route path="/entrenamiento" element={<WorkoutPlaceholderPage />} />
                <Route path="/nutricion" element={<NutritionPlaceholderPage />} />
                <Route path="/perfil" element={<ProfilePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
