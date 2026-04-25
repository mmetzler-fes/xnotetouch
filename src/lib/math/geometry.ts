export interface Point { x: number; y: number; }

// Ray casting algorithm for point in polygon
export function isPointInPolygon(point: Point, vs: Point[]) {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) != (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Bounding box overlap
export function doBoundingBoxesOverlap(
  box1: { minX: number, maxX: number, minY: number, maxY: number },
  box2: { minX: number, maxX: number, minY: number, maxY: number }
) {
  return !(box1.maxX < box2.minX || 
           box1.minX > box2.maxX || 
           box1.maxY < box2.minY || 
           box1.minY > box2.maxY);
}

export function getPointsBoundingBox(points: Point[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

export function distSq(p1: Point, p2: Point) {
  return Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
}

export function distToSegmentSq(p: Point, v: Point, w: Point) {
  const l2 = distSq(v, w);
  if (l2 === 0) return distSq(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

export function isPointNearPolyline(p: Point, vs: Point[], threshold: number) {
  const thresholdSq = threshold * threshold;
  for (let i = 0; i < vs.length - 1; i++) {
    if (distToSegmentSq(p, vs[i], vs[i+1]) < thresholdSq) return true;
  }
  return false;
}
