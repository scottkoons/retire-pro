// ============================================================================
// Plan file — File System Access API binding.
//
// localStorage is the boot-time source of truth (synchronous, no flicker), but
// it lives inside the browser profile: "Clear browsing data" wipes it and no
// backup tool can see it. Binding the plan to a REAL file lets every autosave
// write through to disk, so a folder that is already backed up (Resilio, iCloud,
// Time Machine) covers the plan too, and a cleared browser can be restored from
// the file on next load.
//
// Chrome and Edge implement this API; Safari and Firefox do not. Every entry
// point degrades to "unsupported" rather than throwing, so the app is unchanged
// where the API is missing.
// ============================================================================

/** Permission states we care about. `prompt` means a user gesture is required. */
export type PlanFilePermission = 'granted' | 'denied' | 'prompt';

interface HandlePermissionDescriptor {
  mode: 'read' | 'readwrite';
}

interface WritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Structural subset of FileSystemFileHandle. Declared locally rather than
 * relying on lib.dom: the handle permission methods and the window pickers are
 * not in TypeScript's DOM typings, and redeclaring the real interface name
 * would collide with the lib versions that do exist.
 */
export interface PlanFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableStream>;
  queryPermission?(d: HandlePermissionDescriptor): Promise<PlanFilePermission>;
  requestPermission?(d: HandlePermissionDescriptor): Promise<PlanFilePermission>;
}

interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (o?: {
    suggestedName?: string;
    types?: FilePickerType[];
    id?: string;
  }) => Promise<PlanFileHandle>;
  showOpenFilePicker?: (o?: {
    types?: FilePickerType[];
    multiple?: boolean;
    id?: string;
  }) => Promise<PlanFileHandle[]>;
};

const JSON_TYPE: FilePickerType = {
  description: 'RetirePro plan',
  accept: { 'application/json': ['.json'] },
};

// `id` makes the browser reopen the picker in the same directory next time.
const PICKER_ID = 'retirepro-plan';
const SUGGESTED_NAME = 'retirepro-plan.json';

export function planFileSupported(): boolean {
  const w = window as PickerWindow;
  return typeof w.showSaveFilePicker === 'function';
}

// ---------------------------------------------------------------------------
// Handle persistence.
//
// A FileSystemFileHandle is structured-cloneable but NOT JSON-serializable, so
// it cannot live in localStorage — IndexedDB is the only place it survives a
// reload. This is a deliberately tiny wrapper; a full IDB library would be more
// dependency than one key/value pair is worth.
// ---------------------------------------------------------------------------

const DB_NAME = 'retirepro-fs';
const DB_VERSION = 1;
const STORE = 'handles';
const HANDLE_KEY = 'plan';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbRequest<T>(run: (store: IDBObjectStore) => IDBRequest, mode: IDBTransactionMode): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
      }),
  );
}

/** The handle saved by a previous session, or null if none / unreadable. */
export async function savedPlanHandle(): Promise<PlanFileHandle | null> {
  if (!planFileSupported()) return null;
  try {
    const h = await idbRequest<PlanFileHandle | undefined>((s) => s.get(HANDLE_KEY), 'readonly');
    return h ?? null;
  } catch {
    return null;
  }
}

async function rememberPlanHandle(handle: PlanFileHandle): Promise<void> {
  await idbRequest((s) => s.put(handle, HANDLE_KEY), 'readwrite');
}

export async function forgetPlanHandle(): Promise<void> {
  try {
    await idbRequest((s) => s.delete(HANDLE_KEY), 'readwrite');
  } catch {
    /* nothing to forget */
  }
}

// ---------------------------------------------------------------------------
// Pickers. Both must be called from a user gesture, and both resolve to null
// when the user cancels (the API rejects with AbortError rather than resolving).
// ---------------------------------------------------------------------------

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/** Create (or overwrite) a plan file and remember it. Null if cancelled. */
export async function pickNewPlanFile(): Promise<PlanFileHandle | null> {
  const w = window as PickerWindow;
  if (!w.showSaveFilePicker) return null;
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: SUGGESTED_NAME,
      types: [JSON_TYPE],
      id: PICKER_ID,
    });
    await rememberPlanHandle(handle);
    return handle;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

/** Attach to an EXISTING plan file (e.g. one restored from a backup). */
export async function pickExistingPlanFile(): Promise<PlanFileHandle | null> {
  const w = window as PickerWindow;
  if (!w.showOpenFilePicker) return null;
  try {
    const [handle] = await w.showOpenFilePicker({ types: [JSON_TYPE], multiple: false, id: PICKER_ID });
    if (!handle) return null;
    await rememberPlanHandle(handle);
    return handle;
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Permissions. Chrome drops a handle's permission back to `prompt` when the
// browser restarts, so a reconnect click is required once per session. Handles
// created in THIS session are already granted and never prompt.
// ---------------------------------------------------------------------------

/** Current permission without prompting. */
export async function checkPermission(handle: PlanFileHandle): Promise<PlanFilePermission> {
  if (!handle.queryPermission) return 'granted'; // no permissions model: assume usable
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

/** Prompt for permission. MUST be called from a user gesture or it resolves `prompt`. */
export async function requestPermission(handle: PlanFileHandle): Promise<PlanFilePermission> {
  if (!handle.requestPermission) return 'granted';
  try {
    return await handle.requestPermission({ mode: 'readwrite' });
  } catch {
    return 'denied';
  }
}

// ---------------------------------------------------------------------------
// Read / write.
// ---------------------------------------------------------------------------

export async function readPlanFile(handle: PlanFileHandle): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

// Writes are coalesced: autosave already debounces, but a burst of edits must
// never interleave two writable streams on the same file. The newest text wins.
let writing = false;
let queued: { handle: PlanFileHandle; text: string } | null = null;

export async function writePlanFile(handle: PlanFileHandle, text: string): Promise<void> {
  queued = { handle, text };
  if (writing) return; // the in-flight loop will pick up the newest text
  writing = true;
  try {
    while (queued) {
      const job = queued;
      queued = null;
      const w = await job.handle.createWritable();
      await w.write(job.text);
      await w.close();
    }
  } finally {
    writing = false;
  }
}
