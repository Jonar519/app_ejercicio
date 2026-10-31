import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { formatLongDate, formatNumber, parseLocalDate, toLocalDate } from '../../lib/format';
import { useSettings } from '../profile/hooks';
import { totalCalories, type FoodLog } from './food';
import { FoodForm } from './FoodForm';
import { useDeleteFood, useFoodLogs, useSaveFood } from './hooks';

const shiftDate = (date: string, days: number) => {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  return toLocalDate(shifted);
};

const iconButtonClass = 'min-w-11 px-2';

export function NutritionPage() {
  const today = toLocalDate(new Date());
  const [date, setDate] = useState(today);
  const logs = useFoodLogs(date);
  const settings = useSettings();
  const save = useSaveFood(date);

  return (
    <>
      <h1 className="text-3xl font-bold">Nutrición</h1>
      <DateSelector date={date} today={today} onChange={setDate} />
      {logs.isPending && <Loading />}
      {logs.isError && (
        <>
          <FormMessage kind="error">No se pudieron cargar tus alimentos.</FormMessage>
          <Button variant="secondary" onClick={() => void logs.refetch()}>
            Reintentar
          </Button>
        </>
      )}
      {logs.data && (
        <>
          {settings.data && (
            <CalorieProgress
              total={totalCalories(logs.data)}
              goal={settings.data.daily_calorie_goal}
            />
          )}
          <FoodForm pending={save.isPending} failed={save.isError} onSave={save.mutateAsync} />
          <FoodList logs={logs.data} date={date} />
        </>
      )}
    </>
  );
}

interface DateSelectorProps {
  date: string;
  today: string;
  onChange: (date: string) => void;
}

function DateSelector({ date, today, onChange }: DateSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className={iconButtonClass}
          aria-label="Día anterior"
          onClick={() => onChange(shiftDate(date, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <input
          type="date"
          aria-label="Fecha"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-400 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
          value={date}
          max={today}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
        />
        <Button
          variant="secondary"
          className={iconButtonClass}
          aria-label="Día siguiente"
          disabled={date >= today}
          onClick={() => onChange(shiftDate(date, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <p className="text-center text-neutral-700 first-letter:uppercase dark:text-neutral-300">
        {date === today ? 'Hoy' : formatLongDate(parseLocalDate(date))}
      </p>
    </div>
  );
}

interface CalorieProgressProps {
  total: number;
  goal: number;
}

function CalorieProgress({ total, goal }: CalorieProgressProps) {
  const difference = goal - total;
  const exceeded = difference < 0;
  const percent = Math.min(100, Math.round((total / goal) * 100));

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-white p-4 dark:bg-neutral-800">
      <p className="text-2xl font-bold tabular-nums">
        {formatNumber(total)}{' '}
        <span className="text-base font-normal">de {formatNumber(goal)} kcal</span>
      </p>
      <div
        role="progressbar"
        aria-label="Calorías del día frente a la meta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
      >
        <div
          className={`h-full w-(--progress) rounded-full ${exceeded ? 'bg-red-700 dark:bg-red-400' : 'bg-emerald-700 dark:bg-emerald-400'}`}
          ref={(element) => element?.style.setProperty('--progress', `${percent}%`)}
        />
      </div>
      <p>
        {exceeded
          ? `${formatNumber(-difference)} kcal excedidas`
          : `${formatNumber(difference)} kcal restantes`}
      </p>
    </section>
  );
}

interface FoodListProps {
  logs: FoodLog[];
  date: string;
}

function FoodList({ logs, date }: FoodListProps) {
  if (logs.length === 0) return <p>No hay alimentos registrados este día.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {logs.map((log) => (
        <FoodItem key={log.id} log={log} date={date} />
      ))}
    </ul>
  );
}

interface FoodItemProps {
  log: FoodLog;
  date: string;
}

function FoodItem({ log, date }: FoodItemProps) {
  const [editing, setEditing] = useState(false);
  const save = useSaveFood(date);
  const remove = useDeleteFood();

  if (editing) {
    return (
      <li className="rounded-lg bg-white p-3 dark:bg-neutral-800">
        <FoodForm
          food={log}
          pending={save.isPending}
          failed={save.isError}
          onCancel={() => setEditing(false)}
          onSave={async (food) => {
            await save.mutateAsync({ ...food, id: log.id });
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg bg-white p-3 dark:bg-neutral-800">
      <span className="min-w-0 flex-1 break-words">{log.name}</span>
      <span className="tabular-nums">{formatNumber(log.calories)} kcal</span>
      <Button
        variant="secondary"
        className={iconButtonClass}
        aria-label={`Editar ${log.name}`}
        onClick={() => setEditing(true)}
      >
        <Pencil aria-hidden="true" size={18} />
      </Button>
      <Button
        variant="secondary"
        className={iconButtonClass}
        aria-label={`Eliminar ${log.name}`}
        disabled={remove.isPending}
        onClick={() => remove.mutate(log.id)}
      >
        <Trash2 aria-hidden="true" size={18} />
      </Button>
    </li>
  );
}
