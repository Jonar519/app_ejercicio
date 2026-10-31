import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { TextField } from '../../components/TextField';
import type { WeightUnit } from '../../lib/units';
import { useLogWeight } from './hooks';
import { parseWeightInput } from './weight';

interface WeighInFormProps {
  globalDay: number;
  unit: WeightUnit;
}

export function WeighInForm({ globalDay, unit }: WeighInFormProps) {
  const logWeight = useLogWeight(globalDay);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseWeightInput(value, unit);
    setError(parsed.error);
    if (parsed.kg !== undefined) logWeight.mutate(parsed.kg);
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
      <TextField
        label={`Peso de hoy (${unit})`}
        hint="Pesaje obligatorio para cerrar este día."
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
      />
      {logWeight.isError && (
        <FormMessage kind="error">No se pudo guardar el peso. Inténtalo de nuevo.</FormMessage>
      )}
      <Button type="submit" disabled={logWeight.isPending}>
        Registrar peso
      </Button>
    </form>
  );
}
