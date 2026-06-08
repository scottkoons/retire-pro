import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconPlus, IconTrash } from '@/components/icons';

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

export function Grid({ children, minWidth }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
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
              className={clsx('border-b border-border-strong px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]', active ? 'text-ink' : 'text-muted', alignCls)}
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
        <th className="w-10 border-b border-border-strong" />
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

export function DeleteCell({ onClick }: { onClick: () => void }) {
  return (
    <td className="px-2 text-center">
      <button
        onClick={onClick}
        className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
        aria-label="Delete row"
      >
        <IconTrash className="h-4 w-4" />
      </button>
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
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  align?: 'left' | 'right';
}) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', align === 'right' && 'justify-end')}>
      {prefix && <span className="text-faint">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
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
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={clsx(inputCls, 'cursor-pointer [color-scheme:dark]')}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
