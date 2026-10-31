import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { REQUEST_SENT_MESSAGE, requestPasswordReset } from './authApi';
import { AuthLayout } from './AuthLayout';
import { firstErrors, recoverSchema } from './schemas';

export function RecoverPage() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [failure, setFailure] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    const parsed = recoverSchema.safeParse({ email });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (!parsed.success) return;

    setPending(true);
    const result = await requestPasswordReset(parsed.data.email);
    setPending(false);
    if (result.ok) setSent(true);
    else setFailure(result.message);
  };

  return (
    <AuthLayout title="Recuperar contraseña">
      {sent ? (
        <FormMessage kind="success">{REQUEST_SENT_MESSAGE}</FormMessage>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
          />
          <FormMessage kind="error">{failure}</FormMessage>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <Link className="link-action text-center" to="/iniciar-sesion">
        Volver a iniciar sesión
      </Link>
    </AuthLayout>
  );
}
