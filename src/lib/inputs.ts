/**
 * onChange handler for numeric config inputs (<input type="number">).
 * Ignores empty or non-numeric values so clearing a field mid-edit never
 * commits 0 to the plan (Number('') === 0 would otherwise persist, e.g.
 * wiping Model End Age to 0 and collapsing the projection).
 * Pass scale=100 for percent fields stored as decimal rates.
 */
export function onNum(commit: (n: number) => void, scale = 1): (e: { target: { value: string } }) => void {
  return (e) => {
    const v = e.target.value.trim();
    if (v === '') return;
    const n = Number(v);
    if (Number.isFinite(n)) commit(n / scale);
  };
}
