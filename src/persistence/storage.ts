import { saveAs } from 'file-saver';
import type { PersistedDocument, UiState } from '@/domain/types';
import { seedDocument, defaultUi } from '@/domain/seed';
import { APP_VERSION, SCHEMA_VERSION, STORAGE_KEY, UI_KEY } from './constants';
import { migrate } from './migrations';
import { BackupFileSchema, PersistedDocumentSchema, UiStateSchema } from './schema';

export interface LoadResult {
  doc: PersistedDocument;
  ui: UiState;
  recovered?: string;
  /**
   * True when no usable document was in localStorage and the seed plan was used
   * instead. The plan-file sync keys off this: a browser whose storage was
   * cleared must always adopt the file, never overwrite it with the demo plan
   * just because the seed carries a newer `savedAt`.
   */
  fresh?: boolean;
}

export function loadDocument(): LoadResult {
  let raw: unknown;
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return { ...seedDocument(), fresh: true };
    raw = JSON.parse(text);
  } catch {
    return recoverCorrupt('Unreadable storage (invalid JSON)');
  }

  try {
    const migrated = migrate(raw as Record<string, unknown>);
    const doc = PersistedDocumentSchema.parse(migrated) as PersistedDocument;
    let ui = defaultUi();
    try {
      const uiText = localStorage.getItem(UI_KEY);
      if (uiText) ui = UiStateSchema.parse(JSON.parse(uiText));
    } catch {
      /* ignore ui errors */
    }
    return { doc, ui };
  } catch (err) {
    return recoverCorrupt(err instanceof Error ? err.message : 'Validation failed');
  }
}

function recoverCorrupt(reason: string): LoadResult {
  try {
    const bad = localStorage.getItem(STORAGE_KEY);
    if (bad) localStorage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, bad);
  } catch {
    /* ignore */
  }
  // eslint-disable-next-line no-console
  console.error('[RetirePro] Falling back to seed; reason:', reason);
  return { ...seedDocument(), recovered: reason, fresh: true };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  /**
   * The exact stamped payload that was written. Returned so the plan-file
   * mirror writes byte-identical content with the SAME `savedAt` — if the file
   * carried a stale timestamp it would always look older than localStorage and
   * could never win the newer-copy comparison on the next load. Populated even
   * when the localStorage write fails, so a quota error does not also cost the
   * file write.
   */
  saved: PersistedDocument;
}

export function saveDocument(doc: PersistedDocument, ui: UiState): SaveResult {
  const payload: PersistedDocument = {
    ...doc,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
    return { ok: true, saved: payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed', saved: payload };
  }
}

/** Serialized backup payload — shared by the file export and the clipboard transfer. */
export function backupJSON(doc: PersistedDocument): string {
  const file = {
    kind: 'retirepro-backup' as const,
    schemaVersion: doc.schemaVersion,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    document: doc,
  };
  return JSON.stringify(file, null, 2);
}

export function exportBackup(doc: PersistedDocument): void {
  const blob = new Blob([backupJSON(doc)], { type: 'application/json' });
  saveAs(blob, `retirepro-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export function parseBackup(text: string): { ok: true; doc: PersistedDocument } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const file = BackupFileSchema.safeParse(parsed);
  if (!file.success) return { ok: false, error: 'Not a RetirePro backup file.' };
  const migrated = migrate(file.data.document as Record<string, unknown>);
  const doc = PersistedDocumentSchema.safeParse(migrated);
  if (!doc.success) return { ok: false, error: `Backup failed validation: ${doc.error.issues[0]?.message ?? 'invalid'}` };
  return { ok: true, doc: doc.data as PersistedDocument };
}
