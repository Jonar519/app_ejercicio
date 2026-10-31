import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { REQUEST_SENT_MESSAGE, register } from './authApi';
import { AuthLayout } from './AuthLayout';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { MIN_PASSWORD_LENGTH, firstErrors, registerSchema } from './schemas';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [failure, setFailure] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = registerSchema.safeParse({ email, password, confirmation });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (!parsed.success) return;

    setPending(true);
    const result = await register(parsed.data.email, parsed.data.password);
    setPending(false);
    if (!result.ok) setFailure(result.message);
    else if (result.awaitingConfirmation) setSent(true);
  };

  if (sent) {
    return (
      <AuthLayout title="Revisa tu correo">
        <FormMessage kind="success">{REQUEST_SENT_MESSAGE}</FormMessage>
        <Link className="link-action text-center" to="/iniciar-sesion">
          Volver a iniciar sesión
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Crear cuenta">
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
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
      <Link className="link-action text-center" to="/iniciar-sesion">
        Ya tengo una cuenta
      </Link>
    </AuthLayout>
  );
}
