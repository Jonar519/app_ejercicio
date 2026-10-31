import { ArrowLeft } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { FormMessage } from '../../components/FormMessage';
import { Loading } from '../../components/Loading';
import { formatDate, formatNumber } from '../../lib/format';
import { fromKg, type WeightUnit } from '../../lib/units';
import { useSettings } from '../profile/hooks';
import { useWeightLogs } from './hooks';
import { withVariation, type WeightEntry } from './weight';

// Recharts pesa más que el resto de la app: solo se descarga al abrir esta pantalla.
const WeightChart = lazy(() =>
  import('./WeightChart').then(({ WeightChart: chart }) => ({ default: chart })),
);

const formatDelta = (deltaKg: number | null, unit: WeightUnit) => {
  if (deltaKg === null) return '—';
  const value = fromKg(deltaKg, unit);
  return `${value > 0 ? '+' : ''}${formatNumber(value)} ${unit}`;
};

export function WeightHistoryPage() {
  const logs = useWeightLogs();
  const settings = useSettings();
  const unit = settings.data?.weight_unit ?? 'kg';

  return (
    <>
      <Link to="/entrenamiento" className="link-action gap-2 self-start">
        <ArrowLeft aria-hidden="true" size={20} />
        Volver a Hoy
      </Link>
      <h1 className="text-3xl font-bold">Historial de peso</h1>
      {logs.isPending && <Loading />}
      {logs.isError && (
        <>
          <FormMessage kind="error">No se pudo cargar tu historial de peso.</FormMessage>
          <Button variant="secondary" onClick={() => void logs.refetch()}>
            Reintentar
          </Button>
        </>
      )}
      {logs.data?.length === 0 && (
        <p>Aún no hay registros. El primer pesaje llega el día 7 del programa.</p>
      )}
      {logs.data && logs.data.length > 0 && (
        <>
          <Suspense fallback={<Loading />}>
            <WeightChart logs={logs.data} unit={unit} />
          </Suspense>
          <WeightTable entries={withVariation(logs.data).reverse()} unit={unit} />
        </>
      )}
    </>
  );
}

interface WeightTableProps {
  entries: WeightEntry[];
  unit: WeightUnit;
}

function WeightTable({ entries, unit }: WeightTableProps) {
  return (
    <table className="w-full text-left">
      <caption className="sr-only">Registros de peso, del más reciente al más antiguo</caption>
      <thead className="text-sm text-neutral-700 dark:text-neutral-300">
        <tr>
          <th scope="col" className="py-2 font-medium">
            Fecha
          </th>
          <th scope="col" className="py-2 font-medium">
            Día
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Peso
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            Variación
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.global_day}
            className="border-t border-neutral-300 dark:border-neutral-700"
          >
            <td className="py-2">{formatDate(new Date(entry.logged_at))}</td>
            <td className="py-2">{entry.global_day}</td>
            <td className="py-2 text-right tabular-nums">
              {formatNumber(fromKg(entry.weight_kg, unit))} {unit}
            </td>
            <td className="py-2 text-right tabular-nums">{formatDelta(entry.deltaKg, unit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
