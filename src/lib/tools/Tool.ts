import React from 'react';
import { Stroke, LayerElement, Point, XoppDocument } from '../../types/xopp';

export interface ToolContext {
  color: string;
  fillColor: string;
  strokeWidth: number;
  activePageIndex: number;
  activeDoc: XoppDocument;
  addStroke: (stroke: Stroke) => void;
  addElement: (element: LayerElement) => void;
  deleteElements: (ids: string[]) => void;
  setActivePage: (index: number) => void;
}

export abstract class Tool {
  abstract readonly type: string;

  onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext): void {}
  onMouseMove(x: number, y: number, pressure: number, ctx: ToolContext): void {}
  onMouseUp(x: number, y: number, pressure: number, ctx: ToolContext): void {}
  
  // For temporary drawing like lasso or laser pointer
  renderOverlay(ctx: ToolContext): React.ReactNode {
    return null;
  }
}
