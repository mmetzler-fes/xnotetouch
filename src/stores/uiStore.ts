import { create } from 'zustand';

interface PendingImage {
  dataUrl: string;
  width: number;
  height: number;
}

interface UiState {
  scale: number;
  position: { x: number; y: number };
  isSpacePressed: boolean;
  isSidebarVisible: boolean;
  pendingInsertImage: PendingImage | null;
  setScale: (scale: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  setSpacePressed: (isPressed: boolean) => void;
  setSidebarVisible: (visible: boolean) => void;
  setPendingInsertImage: (img: PendingImage | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  scale: 1,
  position: { x: 0, y: 0 },
  isSpacePressed: false,
  isSidebarVisible: true,
  pendingInsertImage: null,
  setScale: (scale) => set({ scale }),
  setPosition: (position) => set({ position }),
  setSpacePressed: (isSpacePressed) => set({ isSpacePressed }),
  setSidebarVisible: (isSidebarVisible) => set({ isSidebarVisible }),
  setPendingInsertImage: (pendingInsertImage) => set({ pendingInsertImage }),
}));
