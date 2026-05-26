import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { MONTHS } from '@/lib/budget-structure';

interface ChartDataPoint {
  month: string;
  budget: number;
  actual: number;
}

interface BudgetVsActualChartProps {
  data: ChartDataPoint[];
  title?: string;
}

export function BudgetVsActualChart({ data, title = 'Budget vs Actual' }: BudgetVsActualChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              formatter={(value: number) => [formatCurrency(value), '']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="budget"
              name="Budget"
              stroke="hsl(var(--chart-budget))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--chart-budget))', strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="hsl(var(--chart-actual))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--chart-actual))', strokeWidth: 2 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Generate sample data for demo
export function generateSampleChartData(): ChartDataPoint[] {
  return MONTHS.map((month, index) => ({
    month,
    budget: 100000 + Math.random() * 50000,
    actual: index < 6 ? 95000 + Math.random() * 60000 : 0,
  }));
}
