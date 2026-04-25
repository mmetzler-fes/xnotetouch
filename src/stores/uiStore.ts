import { create } from 'zustand';

interface UiState {
  scale: number;
  position: { x: number; y: number };
  isSpacePressed: boolean;
  setScale: (scale: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  setSpacePressed: (isPressed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  scale: 1,
  position: { x: 0, y: 0 },
  isSpacePressed: false,
  setScale: (scale) => set({ scale }),
  setPosition: (position) => set({ position }),
  setSpacePressed: (isSpacePressed) => set({ isSpacePressed })
}));
