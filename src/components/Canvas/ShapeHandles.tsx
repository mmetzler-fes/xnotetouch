import React from 'react';
import { Circle as KonvaCircle } from 'react-konva';
import { useDocumentStore } from '../../stores/documentStore';
import { RectElement, LineElement, CircleElement, TriangleElement, ImageElement } from '../../types/xopp';

type GeomElement = RectElement | LineElement | CircleElement | TriangleElement | ImageElement;

interface Props {
  element: GeomElement;
  pageIndex: number;
}

const HR = 6; // handle radius (canvas units)
const HF = '#4CAF50';
const HS = '#fff';

/** Mutate a shape element in the store without a history entry (for live drag). */
export function patchShape(id: string, pageIndex: number, patcher: (el: any) => void) {
  const { documents: docs, activeDocumentIndex: adi } = useDocumentStore.getState();
  const page = docs[adi].pages[pageIndex];
  if (!page) return;
  page.layers.forEach(layer => {
    const el = layer.elements.find(e => e.id === id);
    if (el) patcher(el);
  });
  useDocumentStore.setState({ documents: [...docs] });
}

function Handle({ x, y, onMove, onEnd }: {
  x: number; y: number;
  onMove?: (nx: number, ny: number) => void;
  onEnd?: (nx: number, ny: number) => void;
}) {
  return (
    <KonvaCircle
      x={x} y={y}
      radius={HR}
      fill={HF} stroke={HS} strokeWidth={1.5}
      draggable
      name="shape-handle"
      onDragStart={(e) => { e.cancelBubble = true; }}
      onDragMove={(e) => { e.cancelBubble = true; onMove?.(e.target.x(), e.target.y()); }}
      onDragEnd={(e) => { e.cancelBubble = true; onEnd?.(e.target.x(), e.target.y()); }}
    />
  );
}

export const ShapeHandles: React.FC<Props> = ({ element, pageIndex }) => {
  const id = element.id;

  // ── Rect: 4 corner handles ──────────────────────────────────────────────
  if (element.type === 'rect') {
    const el = element as RectElement;
    const right = el.x + el.width;
    const bottom = el.y + el.height;
    return (
      <>
        {/* top-left */}
        <Handle x={el.x} y={el.y} onMove={(nx, ny) => patchShape(id, pageIndex, (s: RectElement) => {
          s.width = right - nx; s.x = nx;
          s.height = bottom - ny; s.y = ny;
        })} />
        {/* top-right */}
        <Handle x={right} y={el.y} onMove={(nx, ny) => patchShape(id, pageIndex, (s: RectElement) => {
          s.width = nx - s.x;
          s.height = bottom - ny; s.y = ny;
        })} />
        {/* bottom-right */}
        <Handle x={right} y={bottom} onMove={(nx, ny) => patchShape(id, pageIndex, (s: RectElement) => {
          s.width = nx - s.x;
          s.height = ny - s.y;
        })} />
        {/* bottom-left */}
        <Handle x={el.x} y={bottom} onMove={(nx, ny) => patchShape(id, pageIndex, (s: RectElement) => {
          s.width = right - nx; s.x = nx;
          s.height = ny - s.y;
        })} />
      </>
    );
  }

  // ── Line: 2 endpoint handles ────────────────────────────────────────────
  if (element.type === 'line') {
    const el = element as LineElement;
    return (
      <>
        <Handle x={el.x1} y={el.y1} onMove={(nx, ny) => patchShape(id, pageIndex, (s: LineElement) => {
          s.x1 = nx; s.y1 = ny;
        })} />
        <Handle x={el.x2} y={el.y2} onMove={(nx, ny) => patchShape(id, pageIndex, (s: LineElement) => {
          s.x2 = nx; s.y2 = ny;
        })} />
      </>
    );
  }

  // ── Circle: 1 radius handle (right side, 3 o'clock) ────────────────────
  // onDragEnd to avoid the prop-vs-drag position conflict during live updates
  if (element.type === 'circle') {
    const el = element as CircleElement;
    return (
      <Handle
        x={el.cx + el.r} y={el.cy}
        onEnd={(nx, ny) => patchShape(id, pageIndex, (s: CircleElement) => {
          s.r = Math.max(5, Math.sqrt((nx - s.cx) ** 2 + (ny - s.cy) ** 2));
        })}
      />
    );
  }

  // ── Image: 4 corner handles (resize) + center handle (move) ────────────
  if (element.type === 'image') {
    const el = element as ImageElement;
    const right = el.x + el.width;
    const bottom = el.y + el.height;
    return (
      <>
        {/* top-left */}
        <Handle x={el.x} y={el.y} onMove={(nx, ny) => patchShape(id, pageIndex, (s: ImageElement) => {
          s.width = Math.max(20, right - nx); s.x = right - s.width;
          s.height = Math.max(20, bottom - ny); s.y = bottom - s.height;
        })} />
        {/* top-right */}
        <Handle x={right} y={el.y} onMove={(nx, ny) => patchShape(id, pageIndex, (s: ImageElement) => {
          s.width = Math.max(20, nx - s.x);
          s.height = Math.max(20, bottom - ny); s.y = bottom - s.height;
        })} />
        {/* bottom-right */}
        <Handle x={right} y={bottom} onMove={(nx, ny) => patchShape(id, pageIndex, (s: ImageElement) => {
          s.width = Math.max(20, nx - s.x);
          s.height = Math.max(20, ny - s.y);
        })} />
        {/* bottom-left */}
        <Handle x={el.x} y={bottom} onMove={(nx, ny) => patchShape(id, pageIndex, (s: ImageElement) => {
          s.width = Math.max(20, right - nx); s.x = right - s.width;
          s.height = Math.max(20, ny - s.y);
        })} />
        {/* center: move */}
        <Handle x={el.x + el.width / 2} y={el.y + el.height / 2} onMove={(nx, ny) => patchShape(id, pageIndex, (s: ImageElement) => {
          s.x = nx - s.width / 2;
          s.y = ny - s.height / 2;
        })} />
      </>
    );
  }

  // ── Triangle: 3 vertex handles ──────────────────────────────────────────
  if (element.type === 'triangle') {
    const el = element as TriangleElement;
    return (
      <>
        <Handle x={el.x1} y={el.y1} onMove={(nx, ny) => patchShape(id, pageIndex, (s: TriangleElement) => {
          s.x1 = nx; s.y1 = ny;
        })} />
        <Handle x={el.x2} y={el.y2} onMove={(nx, ny) => patchShape(id, pageIndex, (s: TriangleElement) => {
          s.x2 = nx; s.y2 = ny;
        })} />
        <Handle x={el.x3} y={el.y3} onMove={(nx, ny) => patchShape(id, pageIndex, (s: TriangleElement) => {
          s.x3 = nx; s.y3 = ny;
        })} />
      </>
    );
  }

  return null;
};
