import { Tool, ToolContext } from './Tool';
import { Stroke } from '../../types/xopp';

export class HighlighterTool extends Tool {
  readonly type = 'highlighter';
  private activeStroke: Stroke | null = null;

  onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext): void {
    // Opacity is handled via the Konva Shape opacity prop in PressureLine,
    // so store the color without an alpha suffix to avoid double-transparency.
    let color = ctx.color;
    if (color.length === 9) color = color.slice(0, 7); // strip alpha if present

    this.activeStroke = {
      id: `stroke-${Date.now()}`,
      tool: 'highlighter',
      color: color,
      width: ctx.strokeWidth * 3, // Highlighters are thicker
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
