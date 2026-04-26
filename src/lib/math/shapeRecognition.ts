import { Point } from '../../types/xopp';
import { getPointsBoundingBox } from './geometry';

/** Ramer-Douglas-Peucker polyline simplification */
function distPointToSeg(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2);
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0, maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distPointToSeg(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

export type ShapeType = 'line' | 'rect' | 'circle' | 'triangle' | 'none';

export interface ShapeRecognitionResult {
  type: ShapeType;
  circle?: { cx: number; cy: number; r: number };
  triangle?: { x1: number; y1: number; x2: number; y2: number; x3: number; y3: number };
}

export function recognizeShape(points: Point[]): ShapeRecognitionResult {
  if (points.length < 5) return { type: 'none' };

  const box = getPointsBoundingBox(points);
  const start = points[0];
  const end = points[points.length - 1];
  const distStartEnd = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);

  let pathLen = 0;
  for (let i = 1; i < points.length; i++) {
    pathLen += Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
  }

  // --- Line ---
  if (distStartEnd / pathLen > 0.85) {
    return { type: 'line' };
  }

  const boxW = box.maxX - box.minX;
  const boxH = box.maxY - box.minY;
  const diagonal = Math.sqrt(boxW * boxW + boxH * boxH);
  const isClosed = distStartEnd < Math.max(boxW, boxH) * 0.3;

  if (!isClosed) return { type: 'none' };

  // --- Try rect / triangle first via RDP simplification ---
  const simplified = rdp(points, diagonal * 0.05);
  let verts = [...simplified];
  // Remove closing duplicate if start ≈ end
  if (verts.length >= 2) {
    const f = verts[0], l = verts[verts.length - 1];
    if (Math.sqrt((l.x - f.x) ** 2 + (l.y - f.y) ** 2) < diagonal * 0.1) {
      verts = verts.slice(0, -1);
    }
  }

  if (verts.length === 3) {
    return {
      type: 'triangle',
      triangle: {
        x1: verts[0].x, y1: verts[0].y,
        x2: verts[1].x, y2: verts[1].y,
        x3: verts[2].x, y3: verts[2].y,
      },
    };
  }

  if (verts.length === 4) {
    return { type: 'rect' };
  }

  // --- Circle: tighter check, only if RDP didn't reduce to corners ---
  // stdDev/meanR must be very small (< 0.12), and shape must be near-square
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const dists = points.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
  const meanR = dists.reduce((s, d) => s + d, 0) / dists.length;
  const stdDev = Math.sqrt(dists.reduce((s, d) => s + (d - meanR) ** 2, 0) / dists.length);
  const aspectRatio = Math.max(boxW, boxH) / (Math.min(boxW, boxH) || 1);

  if (stdDev / meanR < 0.12 && aspectRatio < 1.25) {
    return { type: 'circle', circle: { cx, cy, r: meanR } };
  }

  return { type: 'none' };
}
