import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  'aria-label'?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="rp-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, var(--primary) ${pct}%, var(--border-strong) ${pct}%)`,
      }}
    />
  );
}

export function ControlTile({
  label,
  icon,
  value,
  unit,
  children,
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-mono">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-head text-[34px] font-bold leading-none text-ink tabnum">{value}</span>
        {unit && <span className="font-mono text-[14px] text-muted">{unit}</span>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export type TileTint = 'blue' | 'green' | 'violet' | 'teal' | 'amber';

// Subtle tints that lift a tile off the dark background: faint fill, soft border,
// a solid left bar, and a light value colour that stays readable on navy.
const TINTS: Record<TileTint, { bar: string; text: string; bg: string; border: string }> = {
  blue: { bar: '#60a5fa', text: '#bfdbfe', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.32)' },
  green: { bar: '#34d399', text: '#a7f3d0', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.32)' },
  violet: { bar: '#a78bfa', text: '#ddd6fe', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.32)' },
  teal: { bar: '#2dd4bf', text: '#99f6e4', bg: 'rgba(45,212,191,0.10)', border: 'rgba(45,212,191,0.32)' },
  amber: { bar: '#fbbf24', text: '#fde68a', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.32)' },
};

export function StatTile({
  label,
  value,
  sub,
  accent,
  tint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: 'success' | 'caution' | 'error' | 'primary';
  tint?: TileTint;
}) {
  const t = tint ? TINTS[tint] : null;
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-lg border bg-card p-4',
        (accent || t) && 'pl-5',
        !t && 'border-border-subtle',
      )}
      style={t ? { backgroundColor: t.bg, borderColor: t.border } : undefined}
    >
      {(accent || t) && (
        <span
          className={clsx(
            'absolute inset-y-3 left-0 w-1 rounded-full',
            accent === 'success' && 'bg-success',
            accent === 'caution' && 'bg-caution',
            accent === 'error' && 'bg-error',
            accent === 'primary' && 'bg-primary',
          )}
          style={t ? { background: t.bar } : undefined}
        />
      )}
      <div className="label-mono mb-1.5">{label}</div>
      <div className="font-head text-[22px] font-semibold text-ink tabnum" style={t ? { color: t.text } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: 'tax' | 'tax-free';
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border bg-card-high p-5',
        tone === 'tax' ? 'border-tax/40' : 'border-tax-free/40',
      )}
    >
      <div
        className={clsx(
          'mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
          tone === 'tax' ? 'text-tax' : 'text-tax-free',
        )}
      >
        {label}
      </div>
      <div className="font-head text-[32px] font-bold text-ink tabnum">{value}</div>
    </div>
  );
}

export function BarRow({
  label,
  sublabel,
  value,
  fraction,
  color,
  chip,
  dim,
}: {
  label: string;
  sublabel?: string;
  value: ReactNode;
  fraction: number;
  color: string;
  chip?: ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={clsx('py-2', dim && 'opacity-55')}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-[15px] font-semibold text-ink">{label}</span>
          {chip}
          {sublabel && <span className="font-mono text-[10px] uppercase tracking-wide text-faint">{sublabel}</span>}
        </div>
        <span className="font-head text-[18px] font-bold text-ink tabnum">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-input">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}
