import { Tool, ToolContext } from './Tool';
import { Stroke } from '../../types/xopp';

export class PenTool extends Tool {
  readonly type = 'pen';
  private activeStroke: Stroke | null = null;

  onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext): void {
    this.activeStroke = {
      id: `stroke-${Date.now()}`,
      tool: 'pen',
      color: ctx.color,
      width: ctx.strokeWidth,
      capStyle: 'round',
      points: [{ x, y, pressure }]
    };
  }

  onMouseMove(x: number, y: number, pressure: number, ctx: ToolContext): void {
    if (this.activeStroke) {
      this.activeStroke.points.push({ x, y, pressure });
    }
  }

  onMouseUp(x: number, y: number, pressure: number, ctx: ToolContext): void {
    if (this.activeStroke) {
      ctx.addStroke(this.activeStroke);
      this.activeStroke = null;
    }
  }

  getActiveStroke() {
    return this.activeStroke;
  }
}
