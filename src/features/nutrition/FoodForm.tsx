import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import { firstErrors } from '../auth/schemas';
import { foodInputSchema, type FoodInput, type FoodLog } from './food';

interface FoodFormProps {
  food?: FoodLog;
  pending: boolean;
  failed: boolean;
  onSave: (food: FoodInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function FoodForm({ food, pending, failed, onSave, onCancel }: FoodFormProps) {
  const [name, setName] = useState(food?.name ?? '');
  const [calories, setCalories] = useState(food ? String(food.calories) : '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = foodInputSchema.safeParse({
      name,
      calories: calories.trim() === '' ? Number.NaN : Number(calories),
    });
    setErrors(parsed.success ? {} : firstErrors(parsed.error));
    if (!parsed.success) return;
    await onSave(parsed.data);
    if (!food) {
      setName('');
      setCalories('');
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Alimento"
        autoComplete="off"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />
      <TextField
        label="Calorías estimadas"
        type="number"
        inputMode="numeric"
        min={0}
        value={calories}
        onChange={(event) => setCalories(event.target.value)}
        error={errors.calories}
      />
      {failed && (
        <FormMessage kind="error">No se pudo guardar el alimento. Inténtalo de nuevo.</FormMessage>
      )}
      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={pending}>
          {food ? 'Guardar cambios' : 'Añadir alimento'}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
