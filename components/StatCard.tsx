import { ReactNode } from 'react';
import { Icon, IconName } from './ui/Icon';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: IconName;
  tone: 'brand' | 'info' | 'warning' | 'success';
  hint?: string;
}

const toneStyles: Record<StatCardProps['tone'], { bg: string; text: string }> = {
  brand: { bg: 'bg-brand-100', text: 'text-brand-600' },
  info: { bg: 'bg-sky-100', text: 'text-sky-600' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-600' },
  success: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
};

export function StatCard({ label, value, icon, tone, hint }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <div className="group rounded-xl border border-ink-200 bg-white p-5 shadow-card transition-all duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${styles.bg} ${styles.text} transition-transform duration-200 group-hover:scale-110`}>
          <Icon name={icon} size={24} />
        </div>
      </div>
    </div>
  );
}
