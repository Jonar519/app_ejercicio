import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { TextField } from '../../components/TextField';
import { updatePassword } from './authApi';
import { AuthLayout } from './AuthLayout';
import { useAuthStore } from './authStore';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { MIN_PASSWORD_LENGTH, firstErrors, resetPasswordSchema } from './schemas';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const recovery = useAuthStore((state) => state.recovery);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = resetPasswordSchema.safeParse({ password, confirmation });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (!parsed.success) return;

    setPending(true);
    const result = await updatePassword(parsed.data.password);
    setPending(false);
    if (result.ok) navigate('/', { replace: true });
    else setFailure(result.message);
  };

  if (status === 'loading') return <Loading />;

  if (!recovery) {
    return (
      <AuthLayout title="Enlace no válido">
        <FormMessage kind="error">El enlace ha caducado o ya se ha usado.</FormMessage>
        <Link className="link-action text-center" to="/recuperar">
          Solicitar otro enlace
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nueva contraseña">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <PasswordStrengthMeter password={password} />
        <TextField
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={errors.confirmation}
        />
        <FormMessage kind="error">{failure}</FormMessage>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </AuthLayout>
  );
}
