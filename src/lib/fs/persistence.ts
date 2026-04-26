import { XoppDocument } from '../../types/xopp';
import { serializeXopp } from '../xopp/serializer';

export let isInternalSaving = false;

export const saveDocument = async (doc: XoppDocument, path: string) => {
  // Nur in Tauri ausführen
  const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) {
    console.warn('saveDocument: Tauri nicht verfügbar, Speichern übersprungen');
    return false;
  }
  
  try {
    isInternalSaving = true;
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const data = serializeXopp(doc);
    await writeFile(path, data);
    console.log(`Auto-saved document to ${path}`);
    // We keep it true for a short moment to let the watch event pass
    setTimeout(() => { isInternalSaving = false; }, 1000);
    return true;
  } catch (err) {
    isInternalSaving = false;
    console.error(`Failed to auto-save document to ${path}:`, err);
    return false;
  }
};
