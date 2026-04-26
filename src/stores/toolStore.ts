import { create } from 'zustand';
import { ToolType } from '../types/xopp';

interface ToolState {
  activeTool: ToolType;
  color: string;
  fillColor: string;
  highlighterColor: string;
  strokeWidth: number;
  highlighterStrokeWidth: number;
  setTool: (tool: ToolType) => void;
  setColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setHighlighterColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setHighlighterStrokeWidth: (width: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'pen',
  color: '#000000ff',
  fillColor: 'transparent',
  highlighterColor: '#ffff00',
  strokeWidth: 1.41,
  highlighterStrokeWidth: 5,
  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set({ color }),
  setFillColor: (fillColor) => set({ fillColor }),
  setHighlighterColor: (highlighterColor) => set({ highlighterColor }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setHighlighterStrokeWidth: (width) => set({ highlighterStrokeWidth: width }),
}));
