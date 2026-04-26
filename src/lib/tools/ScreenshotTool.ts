import { Tool, ToolContext } from './Tool';

export interface ScreenshotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Screenshot tool: drag to define a rectangle on the canvas, release to capture.
 * The actual pixel capture is done in useDrawingHandlers (which has access to stageRef).
 * This class only tracks the drag geometry and exposes it for the overlay.
 */
export class ScreenshotTool extends Tool {
  readonly type = 'screenshot';

  private startX = 0;
  private startY = 0;
  private activeRect: ScreenshotRect | null = null;

  onMouseDown(x: number, y: number, _pressure: number, _ctx: ToolContext): void {
    this.startX = x;
    this.startY = y;
    this.activeRect = { x, y, width: 0, height: 0 };
  }

  onMouseMove(x: number, y: number, _pressure: number, _ctx: ToolContext): void {
    if (!this.activeRect) return;
    const rx = Math.min(this.startX, x);
    const ry = Math.min(this.startY, y);
    const rw = Math.abs(x - this.startX);
    const rh = Math.abs(y - this.startY);
    this.activeRect = { x: rx, y: ry, width: rw, height: rh };
  }

  onMouseUp(_x: number, _y: number, _pressure: number, _ctx: ToolContext): void {
    // Capture handled externally (useDrawingHandlers has stageRef).
    // Clear after capture.
    this.activeRect = null;
  }

  getActiveRect(): ScreenshotRect | null {
    return this.activeRect;
  }
}
