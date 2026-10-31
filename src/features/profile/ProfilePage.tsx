import { useState } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { flushNow, useSyncStore } from '../../lib/offline/sync';
import { signOut } from '../auth/authSession';
import { useUserId } from '../auth/authStore';
import { AvatarEditor } from './AvatarEditor';
import { DataSection } from './DataSection';
import { useProfile, useSettings } from './hooks';
import { NameForm } from './NameForm';
import { SettingsForm } from './SettingsForm';

export function ProfilePage() {
  const userId = useUserId();
  const profile = useProfile();
  const settings = useSettings();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    await flushNow(userId, true);
    const unsynced = useSyncStore.getState().pending;
    const confirmed =
      unsynced === 0 ||
      window.confirm(
        `Tienes ${unsynced} registros sin sincronizar y se perderán al cerrar sesión. ¿Cerrar sesión de todos modos?`,
      );
    if (confirmed) await signOut();
    else setPending(false);
  };

  return (
    <>
      <h1 className="text-3xl font-bold">Perfil</h1>
      {(profile.isPending || settings.isPending) && <Loading />}
      {(profile.isError || settings.isError) && (
        <>
          <FormMessage kind="error">No se pudo cargar tu perfil.</FormMessage>
          <Button
            variant="secondary"
            onClick={() => {
              void profile.refetch();
              void settings.refetch();
            }}
          >
            Reintentar
          </Button>
        </>
      )}
      {profile.data && (
        <>
          <AvatarEditor path={profile.data.avatar_url} />
          <NameForm key={profile.data.display_name} displayName={profile.data.display_name} />
        </>
      )}
      {settings.data && <SettingsForm settings={settings.data} />}
      <DataSection />
      <Button variant="secondary" disabled={pending} onClick={handleSignOut}>
        {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
    </>
  );
}
