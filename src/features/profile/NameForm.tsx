import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { useUserId } from '../auth/authStore';
import { updateDisplayName } from './api';
import { MAX_DISPLAY_NAME_LENGTH, displayNameSchema } from './schemas';

interface NameFormProps {
  displayName: string;
}

export function NameForm({ displayName }: NameFormProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (value: string) => updateDisplayName(userId, value),
    onSuccess: (profile) => queryClient.setQueryData(['profile', userId], profile),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = displayNameSchema.safeParse(name);
    setError(parsed.error?.issues[0]?.message);
    if (parsed.success) mutation.mutate(parsed.data);
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nombre"
        autoComplete="name"
        hint={`Máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
      />
      {mutation.isError && (
        <FormMessage kind="error">No se pudo guardar el nombre. Inténtalo de nuevo.</FormMessage>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        Guardar nombre
      </Button>
    </form>
  );
}
