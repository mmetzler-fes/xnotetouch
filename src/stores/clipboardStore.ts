import { create } from 'zustand';
import { LayerElement } from '../types/xopp';

interface ClipboardState {
  elements: LayerElement[];
  setClipboard: (elements: LayerElement[]) => void;
  clearClipboard: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  elements: [],
  setClipboard: (elements) => set({ elements }),
  clearClipboard: () => set({ elements: [] }),
}));
