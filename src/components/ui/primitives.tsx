import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useRef } from 'react';
import clsx from 'clsx';

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
  const ref = useRef<HTMLInputElement>(null);
  const display = Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsLeft = el.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    const digits = el.value.replace(/[^0-9]/g, '');
    const num = digits === '' ? 0 : Number(digits);
    onChange(num);

    // Re-place the caret after the same number of digits in the regrouped string.
    const formatted = num.toLocaleString('en-US');
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsLeft) {
      if (formatted[pos] >= '0' && formatted[pos] <= '9') seen++;
      pos++;
    }
    requestAnimationFrame(() => ref.current?.setSelectionRange(pos, pos));
  };

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
  const ref = useRef<HTMLInputElement>(null);
  const display = Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsLeft = el.value.slice(0, caret).replace(/[^0-9]/g, '').length;
    const digits = el.value.replace(/[^0-9]/g, '');
    const num = digits === '' ? 0 : Number(digits);
    onChange(num);

    const formatted = num.toLocaleString('en-US');
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsLeft) {
      if (formatted[pos] >= '0' && formatted[pos] <= '9') seen++;
      pos++;
    }
    requestAnimationFrame(() => ref.current?.setSelectionRange(pos, pos));
  };

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

interface SectionProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Section({ eyebrow, title, subtitle, actions, children, className, bodyClassName }: SectionProps) {
  return (
    <Card className={clsx('animate-fade-in', className)}>
      {(title || eyebrow || actions) && (
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            {eyebrow && <div className="label-mono mb-1 flex items-center gap-2">{eyebrow}</div>}
            {title && <h2 className="font-head text-head-md text-ink">{title}</h2>}
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
