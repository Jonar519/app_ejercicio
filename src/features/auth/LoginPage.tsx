import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { logIn } from './authApi';
import { AuthLayout } from './AuthLayout';
import { firstErrors, loginSchema } from './schemas';

const locationState = z.object({ from: z.string().startsWith('/') });

export function LoginPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = loginSchema.safeParse({ email, password });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (!parsed.success) return;

    setPending(true);
    const result = await logIn(parsed.data.email, parsed.data.password);
    setPending(false);
    if (result.ok) {
      navigate(locationState.safeParse(state).data?.from ?? '/', { replace: true });
    } else {
      setFailure(result.message);
    }
  };

  return (
    <AuthLayout title="Iniciar sesión">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <FormMessage kind="error">{failure}</FormMessage>
        <Button type="submit" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <nav className="flex flex-col gap-2 text-center" aria-label="Opciones de acceso">
        <Link className="link-action" to="/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link className="link-action" to="/registro">
          Crear una cuenta
        </Link>
      </nav>
    </AuthLayout>
  );
}
