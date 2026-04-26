import { Tool, ToolContext } from './Tool';
import { Stroke, RectElement, LineElement, CircleElement, TriangleElement } from '../../types/xopp';
import { recognizeShape } from '../math/shapeRecognition';
import { getPointsBoundingBox } from '../math/geometry';

export class ShapeTool extends Tool {
  readonly type = 'shape';
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

  onMouseMove(x: number, y: number, pressure: number, _ctx: ToolContext): void {
    if (this.activeStroke) {
      this.activeStroke.points.push({ x, y, pressure });
    }
  }

  onMouseUp(_x: number, _y: number, _pressure: number, ctx: ToolContext): void {
    if (this.activeStroke && this.activeStroke.points.length > 2) {
      const result = recognizeShape(this.activeStroke.points);

      if (result.type === 'rect') {
        const box = getPointsBoundingBox(this.activeStroke.points);
        const rect: RectElement = {
          id: `rect-${Date.now()}`, type: 'rect',
          x: box.minX, y: box.minY,
          width: box.maxX - box.minX, height: box.maxY - box.minY,
          color: ctx.color, fillColor: ctx.fillColor, strokeWidth: ctx.strokeWidth,
        };
        ctx.addElement(rect);

      } else if (result.type === 'circle' && result.circle) {
        const c = result.circle;
        const circle: CircleElement = {
          id: `circle-${Date.now()}`, type: 'circle',
          cx: c.cx, cy: c.cy, r: c.r,
          color: ctx.color, fillColor: ctx.fillColor, strokeWidth: ctx.strokeWidth,
        };
        ctx.addElement(circle);

      } else if (result.type === 'triangle' && result.triangle) {
        const t = result.triangle;
        const tri: TriangleElement = {
          id: `tri-${Date.now()}`, type: 'triangle',
          x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, x3: t.x3, y3: t.y3,
          color: ctx.color, fillColor: ctx.fillColor, strokeWidth: ctx.strokeWidth,
        };
        ctx.addElement(tri);

      } else if (result.type === 'line') {
        const start = this.activeStroke.points[0];
        const end = this.activeStroke.points[this.activeStroke.points.length - 1];
        const line: LineElement = {
          id: `line-${Date.now()}`, type: 'line',
          x1: start.x, y1: start.y, x2: end.x, y2: end.y,
          color: ctx.color, strokeWidth: ctx.strokeWidth,
        };
        ctx.addElement(line);

      } else {
        ctx.addStroke(this.activeStroke);
      }
      this.activeStroke = null;
    }
  }

  getActiveStroke() {
    return this.activeStroke;
  }
}
