import { Tool, ToolContext } from './Tool';
import { isPointNearPolyline } from '../math/geometry';
import { useDocumentStore } from '../../stores/documentStore';

export class EraserTool extends Tool {
  readonly type = 'eraser';

  onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext): void {
    this.erase(x, y, ctx);
  }

  onMouseMove(x: number, y: number, pressure: number, ctx: ToolContext): void {
    this.erase(x, y, ctx);
  }

  private erase(x: number, y: number, ctx: ToolContext) {
    const page = ctx.activeDoc.pages[ctx.activePageIndex];
    const toDelete: string[] = [];
    
    // Find active layer
    const activeLayer = page.layers.find(l => l.id === ctx.activeDoc.pages[ctx.activePageIndex].layers[page.layers.length-1].id); // Fallback to last
    // Actually, we should use the one from state
    const layer = page.layers.find(l => l.id === (useDocumentStore.getState() as any).activeLayerId) || page.layers[page.layers.length-1];

    layer.elements.forEach(el => {
      if ('points' in el) {
        if (isPointNearPolyline({ x, y }, el.points, 10)) {
          toDelete.push(el.id);
        }
      } else if (el.type === 'rect') {
          if (x >= el.x - 5 && x <= el.x + el.width + 5 && y >= el.y - 5 && y <= el.y + el.height + 5) {
              toDelete.push(el.id);
          }
      } else if (el.type === 'line') {
          if (isPointNearPolyline({ x, y }, [{x: el.x1, y: el.y1}, {x: el.x2, y: el.y2}], 10)) {
              toDelete.push(el.id);
          }
      }
    });

    if (toDelete.length > 0) {
      ctx.deleteElements(toDelete);
    }
  }
}
