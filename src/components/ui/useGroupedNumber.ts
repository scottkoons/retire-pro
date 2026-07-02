import { useRef, type ChangeEvent } from 'react';

/**
 * Shared behavior for whole-dollar text inputs with live thousands separators:
 * strips non-digits, commits the number, and restores the caret by digit count
 * so editing never jumps. MoneyInput, GroupedNumberField, and the grid's
 * GroupedNumberInput all use this and differ only in chrome.
 */
export function useGroupedNumber(value: number, onChange: (n: number) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const display = Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '0';

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  return { ref, display, handleChange };
}
