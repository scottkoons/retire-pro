import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useGroupedNumber } from './useGroupedNumber';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded font-body font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base',
        size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-4 py-2 text-[14px]',
        variant === 'primary' && 'bg-primary text-primary-on hover:bg-primary-hover active:bg-primary-press',
        variant === 'outline' && 'border border-primary text-primary hover:bg-primary-tint',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-ink',
        variant === 'danger' && 'text-muted hover:bg-error-tint hover:text-error',
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-xl border border-border-subtle bg-card', className)}>{children}</div>;
}

/**
 * Currency input with live thousand separators (e.g. "5,258") on a $ chrome.
 * Keeps a whole-dollar number in parent state while displaying the grouped
 * string; the caret is restored by digit-count so editing never jumps.
 */
export function MoneyInput({
  value,
  onChange,
  size = 'md',
  suffix,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: 'sm' | 'md' | 'lg';
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const { ref, display, handleChange } = useGroupedNumber(value, onChange);

  const text = size === 'lg' ? 'text-[19px] font-semibold' : size === 'sm' ? 'text-[13px]' : 'text-[14px]';
  const pad = size === 'lg' ? 'h-11 px-3.5' : size === 'sm' ? 'h-8 px-2.5' : 'h-9 px-3';
  const dollar = size === 'lg' ? 'text-[17px]' : size === 'sm' ? 'text-[13px]' : 'text-[14px]';

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 rounded-md border border-border-strong bg-input transition-colors focus-within:border-primary',
        pad,
        className,
      )}
    >
      <span className={clsx('font-mono text-faint', dollar)}>$</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={display}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        className={clsx('w-full min-w-0 bg-transparent font-mono tabnum text-ink outline-none', text)}
      />
      {suffix && <span className="shrink-0 font-mono text-[12px] text-faint">{suffix}</span>}
    </div>
  );
}

/**
 * Chrome-less integer input with live thousand separators, styled entirely by the
 * passed `className`. Drop-in replacement for a plain `<input type="number">` dollar
 * field in the config forms so amounts read grouped (e.g. 850,000). Caret position is
 * restored by digit count so editing never jumps.
 */
export function GroupedNumberField({
  value,
  onChange,
  className,
  ariaLabel,
  title,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  const { ref, display, handleChange } = useGroupedNumber(value, onChange);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      title={title}
      value={display}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      className={className}
    />
  );
}

/**
 * Numeric config field that commits on blur or Enter (Escape reverts).
 * The projection recalculates once when you finish typing instead of on every
 * keystroke, and a cleared field never commits 0. `value` is the display value
 * (already scaled, e.g. percent); `onCommit` receives the typed number.
 */
export function NumField({
  value,
  onCommit,
  step,
  className,
  ariaLabel,
  min,
  max,
}: {
  value: number;
  onCommit: (n: number) => void;
  step?: number;
  className?: string;
  ariaLabel?: string;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false); // Escape: blur must revert, not commit the stale draft
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft === null) return;
    let n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n)) {
      // Typed values must respect min/max too (the HTML attributes only guard the spinner).
      if (min != null) n = Math.max(min, n);
      if (max != null) n = Math.min(max, n);
      onCommit(n);
    }
    setDraft(null);
  };
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      aria-label={ariaLabel}
      className={className}
      value={draft ?? (Number.isFinite(value) ? value : 0)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

interface SectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Section({ title, subtitle, actions, children, className, bodyClassName }: SectionProps) {
  return (
    <Card className={clsx('animate-fade-in', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            {title && <h2 className="font-head text-[20px] font-semibold leading-7 tracking-[-0.01em] text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={clsx('px-6 pb-6 pt-4', bodyClassName)}>{children}</div>
    </Card>
  );
}

export function ScenarioChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-primary text-primary-on'
          : 'border border-border-strong text-muted hover:border-primary/50 hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

export function TaxChip({ status }: { status: 'taxable' | 'tax-free' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
        status === 'taxable'
          ? 'bg-tax-tint text-tax'
          : 'bg-tax-free-tint text-tax-free',
      )}
    >
      {status === 'taxable' ? 'Tax' : 'Tax-free'}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-full border border-border-subtle bg-input p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-full font-mono uppercase tracking-wide transition-colors',
            size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-[12px]',
            value === o.value ? 'bg-primary text-primary-on' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: 'onTrack' | 'caution' | 'shortfall' }) {
  const map = {
    onTrack: { c: 'bg-success-tint text-success', t: 'On Track' },
    caution: { c: 'bg-caution-tint text-caution', t: 'Caution' },
    shortfall: { c: 'bg-error-tint text-error', t: 'Shortfall' },
  } as const;
  const m = map[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide', m.c)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.t}
    </span>
  );
}
