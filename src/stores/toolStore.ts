import { create } from 'zustand';
import { ToolType } from '../types/xopp';

interface ToolState {
  activeTool: ToolType | 'lasso';
  color: string;
  strokeWidth: number;
  setTool: (tool: ToolType | 'lasso') => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'pen',
  color: '#000000ff',
  strokeWidth: 1.41,
  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
}));
