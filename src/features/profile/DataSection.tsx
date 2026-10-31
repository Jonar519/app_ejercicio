import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { signOut } from '../auth/authSession';
import { useUserId } from '../auth/authStore';
import { deleteMyAccount, exportMyData } from './api';

const CONFIRMATION_WORD = 'ELIMINAR';

const downloadJson = (data: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export function DataSection() {
  const userId = useUserId();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const exportMutation = useMutation({ mutationFn: exportMyData, onSuccess: downloadJson });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteMyAccount(userId, confirmation);
      await signOut();
    },
  });

  const handleDelete = (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === CONFIRMATION_WORD) deleteMutation.mutate();
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="data-title">
      <h2 id="data-title" className="text-xl font-semibold">
        Mis datos
      </h2>
      <Button
        variant="secondary"
        disabled={exportMutation.isPending}
        onClick={() => exportMutation.mutate()}
      >
        {exportMutation.isPending ? 'Preparando…' : 'Exportar mis datos'}
      </Button>
      {exportMutation.isError && (
        <FormMessage kind="error">No se pudieron exportar tus datos.</FormMessage>
      )}
      {confirming ? (
        <form className="flex flex-col gap-3" onSubmit={handleDelete} noValidate>
          <FormMessage kind="error">
            Se borrarán tu cuenta y todos tus datos de forma permanente. Esta acción no se puede
            deshacer.
          </FormMessage>
          <TextField
            label={`Escribe ${CONFIRMATION_WORD} para confirmar`}
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          {deleteMutation.isError && (
            <FormMessage kind="error">
              No se pudo eliminar la cuenta. Inténtalo de nuevo.
            </FormMessage>
          )}
          <Button
            type="submit"
            variant="danger"
            disabled={confirmation !== CONFIRMATION_WORD || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Button>
          <Button
            variant="secondary"
            disabled={deleteMutation.isPending}
            onClick={() => {
              setConfirming(false);
              setConfirmation('');
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Eliminar mi cuenta
        </Button>
      )}
    </section>
  );
}
