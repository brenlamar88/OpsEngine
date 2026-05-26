import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'positive' | 'negative' | 'neutral';
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  variant = 'neutral',
  className,
}: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'kpi-card animate-fade-in',
        variant === 'positive' && 'kpi-card-positive',
        variant === 'negative' && 'kpi-card-negative',
        variant === 'neutral' && 'kpi-card-neutral',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
              trend === 'up' && 'bg-positive/10 text-positive',
              trend === 'down' && 'bg-negative/10 text-negative',
              trend === 'neutral' && 'bg-muted text-muted-foreground'
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
