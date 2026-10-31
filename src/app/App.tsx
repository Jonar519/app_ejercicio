import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { RecoverPage } from '../features/auth/RecoverPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { GuestOnly, RequireAuth } from '../features/auth/RequireAuth';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { NutritionPage } from '../features/nutrition/NutritionPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { SyncBoundary } from '../features/pwa/SyncBoundary';
import { UpdatePrompt } from '../features/pwa/UpdatePrompt';
import { RunnerPage } from '../features/workout/RunnerPage';
import { TodayPage } from '../features/workout/TodayPage';
import { WeightHistoryPage } from '../features/weigh-in/WeightHistoryPage';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';
import { queryClient } from './queryClient';

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UpdatePrompt />
        <BrowserRouter>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/iniciar-sesion" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/recuperar" element={<RecoverPage />} />
            </Route>
            <Route path="/restablecer" element={<ResetPasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<SyncBoundary />}>
                <Route path="/entrenamiento/sesion" element={<RunnerPage />} />
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/entrenamiento" replace />} />
                  <Route path="/entrenamiento" element={<TodayPage />} />
                  <Route path="/entrenamiento/peso" element={<WeightHistoryPage />} />
                  <Route path="/nutricion" element={<NutritionPage />} />
                  <Route path="/perfil" element={<ProfilePage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
