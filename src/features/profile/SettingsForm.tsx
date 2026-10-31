import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { firstErrors } from '../auth/schemas';
import { useUserId } from '../auth/authStore';
import { updateSettings } from './api';
import { settingsSchema, type Settings } from './schemas';

interface SettingsFormProps {
  settings: Settings;
}

const toNumber = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

export function SettingsForm({ settings }: SettingsFormProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [weightUnit, setWeightUnit] = useState(settings.weight_unit);
  const [calorieGoal, setCalorieGoal] = useState(String(settings.daily_calorie_goal));
  const [restSets, setRestSets] = useState(String(settings.rest_between_sets_seconds));
  const [restExercises, setRestExercises] = useState(
    String(settings.rest_between_exercises_seconds),
  );
  const [sound, setSound] = useState(settings.sound_enabled);
  const [vibration, setVibration] = useState(settings.vibration_enabled);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const mutation = useMutation({
    mutationFn: (values: Settings) => updateSettings(userId, values),
    onSuccess: (saved) => queryClient.setQueryData(['settings', userId], saved),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = settingsSchema.safeParse({
      weight_unit: weightUnit,
      daily_calorie_goal: toNumber(calorieGoal),
      rest_between_sets_seconds: toNumber(restSets),
      rest_between_exercises_seconds: toNumber(restExercises),
      sound_enabled: sound,
      vibration_enabled: vibration,
    });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (parsed.success) mutation.mutate(parsed.data);
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <h2 className="text-xl font-semibold">Preferencias</h2>
      <fieldset className="flex gap-4">
        <legend className="font-medium">Unidad de peso</legend>
        {(['kg', 'lb'] as const).map((unit) => (
          <label key={unit} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="weight-unit"
              className="size-5"
              checked={weightUnit === unit}
              onChange={() => setWeightUnit(unit)}
            />
            {unit}
          </label>
        ))}
      </fieldset>
      <TextField
        label="Meta diaria de calorías"
        type="number"
        inputMode="numeric"
        value={calorieGoal}
        onChange={(event) => setCalorieGoal(event.target.value)}
        error={errors.daily_calorie_goal}
      />
      <TextField
        label="Descanso entre series (s)"
        type="number"
        inputMode="numeric"
        value={restSets}
        onChange={(event) => setRestSets(event.target.value)}
        error={errors.rest_between_sets_seconds}
      />
      <TextField
        label="Descanso entre ejercicios (s)"
        type="number"
        inputMode="numeric"
        value={restExercises}
        onChange={(event) => setRestExercises(event.target.value)}
        error={errors.rest_between_exercises_seconds}
      />
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          className="size-5"
          checked={sound}
          onChange={(event) => setSound(event.target.checked)}
        />
        Sonido
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input
          type="checkbox"
          className="size-5"
          checked={vibration}
          onChange={(event) => setVibration(event.target.checked)}
        />
        Vibración
      </label>
      {mutation.isError && (
        <FormMessage kind="error">
          No se pudieron guardar las preferencias. Inténtalo de nuevo.
        </FormMessage>
      )}
      {mutation.isSuccess && <FormMessage kind="success">Preferencias guardadas.</FormMessage>}
      <Button type="submit" disabled={mutation.isPending}>
        Guardar preferencias
      </Button>
    </form>
  );
}
