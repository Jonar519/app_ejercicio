import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '../../lib/format';
import { fromKg, type WeightUnit } from '../../lib/units';
import type { WeightLog } from './weight';

const AXIS_TICK = { fill: 'currentColor', fontSize: 12 };

interface WeightChartProps {
  logs: WeightLog[];
  unit: WeightUnit;
}

/** Va acompañado de la tabla del historial, que es su alternativa accesible. */
export function WeightChart({ logs, unit }: WeightChartProps) {
  const data = logs.map((log) => ({ day: log.global_day, weight: fromKg(log.weight_kg, unit) }));

  return (
    <figure
      aria-label={`Gráfico de la evolución del peso en ${unit}. Los datos están en la tabla siguiente.`}
      className="h-64 w-full text-neutral-700 dark:text-neutral-300"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeDasharray="0"
          />
          <XAxis
            dataKey="day"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
            tickFormatter={(day: number) => `D${day}`}
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={['dataMin - 1', 'dataMax + 1']}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <Tooltip
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.4 }}
            contentStyle={{
              background: 'var(--chart-surface)',
              border: '1px solid var(--chart-border)',
              borderRadius: 8,
              color: 'var(--chart-text)',
            }}
            labelStyle={{ color: 'var(--chart-text)' }}
            itemStyle={{ color: 'var(--chart-text)' }}
            labelFormatter={(day) => `Día ${String(day)}`}
            formatter={(value) => [`${formatNumber(Number(value))} ${unit}`, 'Peso']}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={{
              r: 4,
              fill: 'var(--chart-line)',
              stroke: 'var(--chart-surface)',
              strokeWidth: 2,
            }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
