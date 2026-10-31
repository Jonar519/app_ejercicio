import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { useUserId } from '../auth/authStore';
import { replaceAvatar } from './api';
import { ALLOWED_AVATAR_TYPES, compressAvatar, validateAvatarFile } from './avatar';
import { useAvatarUrl } from './hooks';

interface AvatarEditorProps {
  path: string | null;
}

interface Draft {
  image: Blob;
  previewUrl: string;
}

export function AvatarEditor({ path }: AvatarEditorProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const avatarUrl = useAvatarUrl(path);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!draft) return;
    return () => URL.revokeObjectURL(draft.previewUrl);
  }, [draft]);

  const mutation = useMutation({
    mutationFn: (image: Blob) => replaceAvatar(userId, image, path),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId], profile);
      setDraft(undefined);
    },
    onError: () => setError('No se pudo guardar la foto. Inténtalo de nuevo.'),
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDraft(undefined);
    const invalid = validateAvatarFile(file);
    setError(invalid ?? undefined);
    if (invalid) return;
    try {
      const image = await compressAvatar(file);
      setDraft({ image, previewUrl: URL.createObjectURL(image) });
    } catch {
      setError('No se pudo leer la imagen. Prueba con otra.');
    }
  };

  const shownUrl = draft?.previewUrl ?? avatarUrl.data;

  return (
    <section className="flex flex-col items-center gap-3" aria-labelledby="avatar-title">
      <h2 id="avatar-title" className="self-start text-xl font-semibold">
        Foto de perfil
      </h2>
      {shownUrl ? (
        <img
          src={shownUrl}
          alt={draft ? 'Vista previa de la foto de perfil' : 'Tu foto de perfil'}
          className="size-28 rounded-full object-cover"
          // Una URL firmada caducada (equipo suspendido) se renueva al fallar la carga.
          onError={() => {
            if (!draft && !avatarUrl.isFetching) void avatarUrl.refetch();
          }}
        />
      ) : (
        <span className="flex size-28 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
          <UserRound aria-hidden="true" size={48} />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_AVATAR_TYPES.join(',')}
        className="sr-only"
        aria-label="Elegir foto de perfil"
        tabIndex={-1}
        onChange={handleFile}
      />
      <FormMessage kind="error">{error}</FormMessage>
      {draft ? (
        <div className="flex w-full gap-2">
          <Button
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(draft.image)}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar foto'}
          </Button>
          <Button
            className="flex-1"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => setDraft(undefined)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          Cambiar foto
        </Button>
      )}
    </section>
  );
}
