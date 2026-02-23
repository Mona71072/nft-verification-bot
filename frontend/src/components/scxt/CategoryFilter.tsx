import { cn } from '@/lib/utils';
import type { ScxtCategory } from '@/hooks/useScxtEvents';

interface CategoryFilterProps {
  value: ScxtCategory;
  onChange: (value: ScxtCategory) => void;
  className?: string;
}

const OPTIONS: { value: ScxtCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'dj', label: 'DJ' },
  { value: 'english', label: 'English' },
];

export function CategoryFilter({ value, onChange, className }: CategoryFilterProps) {
  return (
    <div className={cn('flex gap-1 rounded-lg p-1 bg-white/5', className)}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors rounded-md',
            value === opt.value
              ? 'bg-white/15 text-white'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
