import { Tool, ToolContext } from './Tool';
import { Point } from '../../types/xopp';

interface LaserStroke {
  points: Point[];
  startTime: number;
}

export class LaserPointerTool extends Tool {
  readonly type = 'laser';
  private currentStroke: LaserStroke | null = null;
  private strokes: LaserStroke[] = [];

  onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext): void {
    this.currentStroke = {
      points: [{ x, y }],
      startTime: Date.now()
    };
    this.strokes.push(this.currentStroke);
  }

  onMouseMove(x: number, y: number, pressure: number, ctx: ToolContext): void {
    if (this.currentStroke) {
      this.currentStroke.points.push({ x, y });
    }
  }

  onMouseUp(x: number, y: number, pressure: number, ctx: ToolContext): void {
    this.currentStroke = null;
  }

  getStrokes() {
    const now = Date.now();
    // Keep strokes for 1.5 seconds
    this.strokes = this.strokes.filter(s => now - s.startTime < 1500);
    return this.strokes;
  }
}
