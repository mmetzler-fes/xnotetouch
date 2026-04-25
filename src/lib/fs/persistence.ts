import { writeFile } from '@tauri-apps/plugin-fs';
import { XoppDocument } from '../../types/xopp';
import { serializeXopp } from '../xopp/serializer';

export let isInternalSaving = false;

export const saveDocument = async (doc: XoppDocument, path: string) => {
  try {
    isInternalSaving = true;
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
