import { Tool, ToolContext } from './Tool';
import { Point } from '../../types/xopp';
import { isPointInPolygon, distToSegmentSq, isPointNearPolyline } from '../math/geometry';

/** Threshold in canvas units below which a mouse-down/up is considered a click. */
const CLICK_THRESHOLD = 8;

export class SelectionTool extends Tool {
  readonly type = 'selection';
  private lassoPoints: Point[] = [];
  private isSelecting = false;
  private onSelectionCallback: ((ids: string[]) => void) | null = null;

  /** Register a callback that receives the selected element IDs after mouse-up. */
  setOnSelection(cb: (ids: string[]) => void) {
    this.onSelectionCallback = cb;
  }

  onMouseDown(x: number, y: number, _pressure: number, _ctx: ToolContext): void {
    this.lassoPoints = [{ x, y }];
    this.isSelecting = true;
  }

  onMouseMove(x: number, y: number, _pressure: number, _ctx: ToolContext): void {
    if (this.isSelecting) {
      this.lassoPoints.push({ x, y });
    }
  }

  onMouseUp(x: number, y: number, _pressure: number, ctx: ToolContext): void {
    if (!this.isSelecting) return;

    const startPt = this.lassoPoints[0];
    const isClick = !startPt ||
      Math.hypot(x - startPt.x, y - startPt.y) < CLICK_THRESHOLD;

    const page = ctx.activeDoc.pages[ctx.activePageIndex];

    if (!isClick && this.lassoPoints.length > 2) {
      // Lasso: select elements whose representative points fall inside the polygon
      const selectedIds: string[] = [];
      page.layers.forEach(layer => {
        if (layer.visible === false) return;
        layer.elements.forEach(el => {
          if ('points' in el) {
            if ((el as any).points.some((p: Point) => isPointInPolygon(p, this.lassoPoints))) {
              selectedIds.push(el.id);
            }
          } else if ((el as any).type === 'rect' || (el as any).type === 'image') {
            const cx = (el as any).x + (el as any).width / 2;
            const cy = (el as any).y + (el as any).height / 2;
            if (isPointInPolygon({ x: cx, y: cy }, this.lassoPoints)) selectedIds.push(el.id);
          } else if ((el as any).type === 'line') {
            if (isPointInPolygon({ x: (el as any).x1, y: (el as any).y1 }, this.lassoPoints) ||
                isPointInPolygon({ x: (el as any).x2, y: (el as any).y2 }, this.lassoPoints)) {
              selectedIds.push(el.id);
            }
          } else if ((el as any).type === 'circle') {
            if (isPointInPolygon({ x: (el as any).cx, y: (el as any).cy }, this.lassoPoints)) selectedIds.push(el.id);
          } else if ((el as any).type === 'triangle') {
            const tcx = ((el as any).x1 + (el as any).x2 + (el as any).x3) / 3;
            const tcy = ((el as any).y1 + (el as any).y2 + (el as any).y3) / 3;
            if (isPointInPolygon({ x: tcx, y: tcy }, this.lassoPoints)) selectedIds.push(el.id);
          } else if ('x' in el && 'y' in el) {
            if (isPointInPolygon({ x: (el as any).x, y: (el as any).y }, this.lassoPoints)) selectedIds.push(el.id);
          }
        });
      });
      this.onSelectionCallback?.(selectedIds);
    } else {
      // Click: hit-test at click point, topmost element wins
      const hitId = this.hitTestPoint(x, y, page);
      this.onSelectionCallback?.(hitId ? [hitId] : []);
    }

    this.isSelecting = false;
    this.lassoPoints = [];
  }

  getLassoPoints() {
    return this.lassoPoints;
  }

  // ---- Hit-testing helpers ----

  private hitTestPoint(x: number, y: number, page: any): string | null {
    // Iterate layers topmost-first, elements topmost-first (last drawn = on top)
    for (let li = page.layers.length - 1; li >= 0; li--) {
      const layer = page.layers[li];
      if (layer.visible === false) continue;
      for (let ei = layer.elements.length - 1; ei >= 0; ei--) {
        const el = layer.elements[ei];
        if (this.isPointOnElement(x, y, el)) return el.id;
      }
    }
    return null;
  }

  private isPointOnElement(x: number, y: number, el: any): boolean {
    if (el.type === 'rect' || el.type === 'image') {
      const x0 = Math.min(el.x, el.x + el.width);
      const x1 = Math.max(el.x, el.x + el.width);
      const y0 = Math.min(el.y, el.y + el.height);
      const y1 = Math.max(el.y, el.y + el.height);
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    }
    if (el.type === 'circle') {
      const dx = x - el.cx, dy = y - el.cy;
      return dx * dx + dy * dy <= el.r * el.r;
    }
    if (el.type === 'triangle') {
      return isPointInPolygon({ x, y }, [
        { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }, { x: el.x3, y: el.y3 },
      ]);
    }
    if (el.type === 'line') {
      const thr = Math.max(el.strokeWidth || 2, 10);
      return distToSegmentSq({ x, y }, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= thr * thr;
    }
    if ('points' in el && Array.isArray(el.points) && el.points.length > 0) {
      const thr = Math.max(el.strokeWidth || 2, 10);
      return isPointNearPolyline({ x, y }, el.points, thr);
    }
    return false;
  }
}
