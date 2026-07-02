import { useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconPlus, IconTrash } from '@/components/icons';
import { useGroupedNumber } from '@/components/ui/useGroupedNumber';

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/** Sort a row list by clickable columns. Pass accessors keyed by column sortKey.
 *  Returns the sorted rows plus the current sort and a toggle handler for THead. */
export function useSort<T>(
  rows: T[],
  accessors: Record<string, (row: T) => number | string>,
  initial: SortState,
): { sorted: T[]; sort: SortState; onSort: (key: string) => void } {
  const [sort, setSort] = useState<SortState>(initial);
  const onSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const sorted = useMemo(() => {
    const acc = accessors[sort.key];
    if (!acc) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const x = acc(a);
      const y = acc(b);
      if (x < y) return sort.dir === 'asc' ? -1 : 1;
      if (x > y) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
    // accessors is a fresh object each render; intentionally keyed on rows + sort only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  return { sorted, sort, onSort };
}

export function Grid({ children, minWidth, maxHeight }: { children: ReactNode; minWidth?: number; maxHeight?: string }) {
  // With maxHeight the wrapper also scrolls vertically and the header row sticks.
  return (
    <div className={clsx('overflow-x-auto rounded-xl border border-border-subtle', maxHeight && 'overflow-y-auto')} style={{ maxHeight }}>
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({
  cols,
  sort,
  onSort,
}: {
  cols: { label: string; align?: 'left' | 'right' | 'center'; w?: string; sortKey?: string }[];
  sort?: SortState;
  onSort?: (key: string) => void;
}) {
  return (
    <thead>
      <tr className="bg-card-high">
        {cols.map((c, i) => {
          const sortable = !!c.sortKey && !!onSort;
          const active = !!sort && c.sortKey === sort.key;
          const alignCls = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
          return (
            <th
              key={i}
              style={{ width: c.w }}
              className={clsx('sticky top-0 z-10 border-b border-border-strong bg-card-high px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]', active ? 'text-ink' : 'text-muted', alignCls)}
            >
              {sortable ? (
                <button
                  type="button"
                  onClick={() => onSort!(c.sortKey!)}
                  className={clsx('group inline-flex items-center gap-1 uppercase tracking-[0.06em] transition-colors hover:text-ink', c.align === 'right' && 'flex-row-reverse', c.align === 'center' && 'justify-center')}
                  title={`Sort by ${c.label}`}
                >
                  <span>{c.label}</span>
                  <span className={clsx('text-[9px] leading-none', active ? 'text-primary' : 'text-faint opacity-0 group-hover:opacity-100')}>
                    {active ? (sort!.dir === 'asc' ? '▲' : '▼') : '▲'}
                  </span>
                </button>
              ) : (
                c.label
              )}
            </th>
          );
        })}
        <th className="sticky top-0 z-10 w-10 border-b border-border-strong bg-card-high" />
      </tr>
    </thead>
  );
}

export function TR({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <tr className={clsx('group border-b border-border-subtle hover:bg-hover', dim && 'opacity-50')}>{children}</tr>;
}

export function TD({ children, align, className }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return (
    <td
      className={clsx(
        'px-3 py-1.5 align-middle',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function DeleteCell({
  onClick,
  enabled,
  onToggle,
}: {
  onClick: () => void;
  /** When provided, shows an always-visible "active" checkbox before the trash. */
  enabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <td className="px-2">
      <div className="flex items-center justify-end gap-1.5">
        {onToggle && (
          <input
            type="checkbox"
            checked={enabled ?? true}
            onChange={onToggle}
            title={enabled ? 'Active — uncheck to deactivate (keeps the values)' : 'Inactive — check to include in the plan'}
            aria-label="Include this item in the plan"
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <button
          onClick={onClick}
          className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
          aria-label="Delete row"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
    </td>
  );
}

export function AddRow({ colSpan, onClick, label = 'Add row' }: { colSpan: number; onClick: () => void; label?: string }) {
  return (
    <tfoot>
      <tr>
        <td colSpan={colSpan + 1} className="border-t border-dashed border-border-strong p-0">
          <button onClick={onClick} className="flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium text-primary hover:bg-primary-tint">
            <IconPlus className="h-4 w-4" /> {label}
          </button>
        </td>
      </tr>
    </tfoot>
  );
}

export function TotalRow({ children }: { children: ReactNode }) {
  return <tr className="border-t-2 border-border-strong bg-card-high font-semibold">{children}</tr>;
}

// ---- editable inputs ----
const inputCls =
  'w-full rounded-sm border border-transparent bg-transparent px-1.5 py-1 font-mono text-[13px] text-ink hover:border-border-strong focus:border-primary focus:bg-input focus:outline-none';

export function TextInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, 'font-body', className)} />;
}

export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  step,
  align = 'right',
  grouping,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  align?: 'left' | 'right';
  /** Show live thousands separators (e.g. 268,000). Defaults on for dollar ($) inputs. */
  grouping?: boolean;
}) {
  // Dollar amounts read far better grouped; percents and ages stay plain numeric inputs.
  if (grouping ?? (prefix === '$')) {
    return <GroupedNumberInput value={value} onChange={onChange} prefix={prefix} suffix={suffix} align={align} />;
  }
  return <DraftNumberInput value={value} onChange={onChange} prefix={prefix} suffix={suffix} step={step} align={align} />;
}

/** Age/percent grid input: edits are local while typing and commit on blur or
 *  Enter (Escape reverts), so the projection recalculates once per edit and a
 *  cleared field never commits 0 (Number('') === 0). */
function DraftNumberInput({
  value,
  onChange,
  prefix,
  suffix,
  step,
  align = 'right',
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  align?: 'left' | 'right';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n)) onChange(n);
    setDraft(null);
  };
  return (
    <span className={clsx('inline-flex items-center gap-0.5', align === 'right' && 'justify-end')}>
      {prefix && <span className="text-faint">{prefix}</span>}
      <input
        type="number"
        step={step}
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
        className={clsx(inputCls, align === 'right' ? 'text-right' : 'text-left', 'tabnum')}
      />
      {suffix && <span className="text-faint">{suffix}</span>}
    </span>
  );
}

/** Whole-dollar (grouped integer) input with live thousands separators and caret
 *  restoration, mirroring the MoneyInput chrome but sized for grid cells. */
function GroupedNumberInput({
  value,
  onChange,
  prefix,
  suffix,
  align = 'right',
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  align?: 'left' | 'right';
}) {
  const { ref, display, handleChange } = useGroupedNumber(value, onChange);

  return (
    <span className={clsx('inline-flex items-center gap-0.5', align === 'right' && 'justify-end')}>
      {prefix && <span className="text-faint">{prefix}</span>}
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={(e) => e.target.select()}
        className={clsx(inputCls, align === 'right' ? 'text-right' : 'text-left', 'tabnum')}
      />
      {suffix && <span className="text-faint">{suffix}</span>}
    </span>
  );
}

export function DateInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(inputCls, 'text-muted [color-scheme:dark]')}
    />
  );
}

/** Month + year picker. value/onChange use "yyyy-mm"; the day is always the 1st. */
export function MonthYearInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(inputCls, 'text-muted [color-scheme:dark]')}
    />
  );
}

export function SelectInput<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={clsx(inputCls, 'cursor-pointer pr-5 [color-scheme:dark]')}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
