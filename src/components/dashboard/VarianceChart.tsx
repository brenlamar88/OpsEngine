import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { MONTHS } from '@/lib/budget-structure';

interface VarianceDataPoint {
  month: string;
  variance: number;
}

interface VarianceChartProps {
  data: VarianceDataPoint[];
  title?: string;
}

export function VarianceChart({ data, title = 'Monthly Variance' }: VarianceChartProps) {
  const formatCurrency = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    if (Math.abs(value) >= 1000000) {
      return `${prefix}$${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${prefix}$${(value / 1000).toFixed(0)}K`;
    }
    return `${prefix}$${value}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [formatCurrency(value), 'Variance']}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
            <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.variance >= 0 ? 'hsl(var(--positive))' : 'hsl(var(--negative))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Generate sample data for demo
export function generateSampleVarianceData(): VarianceDataPoint[] {
  return MONTHS.slice(0, 6).map((month) => ({
    month,
    variance: (Math.random() - 0.5) * 40000,
  }));
}
