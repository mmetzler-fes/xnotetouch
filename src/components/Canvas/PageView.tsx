import React, { useState, useEffect } from 'react';
import { Group, Rect, Line, Circle as KonvaCircle, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import { Page, ImageElement, CircleElement, TriangleElement, RectElement, LineElement } from '../../types/xopp';
import type { ScreenshotRect } from '../../lib/tools/ScreenshotTool';
import { PdfLayer } from './PdfLayer';
import { GridLayer } from './GridLayer';
import { PressureLine } from './PressureLine';
import { ShapeHandles } from './ShapeHandles';

// ---------- PastedImage (Konva image element) ----------

const PastedImage: React.FC<{
  element: ImageElement;
  isSelected: boolean;
  activeTool: string;
  pageIndex: number;
}> = ({ element, isSelected, activeTool, pageIndex }) => {
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = element.dataUrl;
    img.onload = () => setImgObj(img);
  }, [element.dataUrl]);
  if (!imgObj) return null;
  const selShadow = isSelected ? { shadowColor: '#4CAF50', shadowBlur: 6, shadowOpacity: 0.9 } : {};
  return (
    <>
      <KonvaImage
        x={element.x} y={element.y}
        width={element.width} height={element.height}
        image={imgObj}
        listening={false}
        {...selShadow}
      />
      {isSelected && activeTool === 'selection' && (
        <ShapeHandles element={element} pageIndex={pageIndex} />
      )}
    </>
  );
};

// ---------- PageView ----------

interface PageViewProps {
  page: Page;
  pageIndex: number;
  offsetY: number;
  activePageIndex: number;
  isDrawing: boolean;
  activeTool: string;
  toolInstances: Record<string, any>;
  lassoPoints: { x: number; y: number }[];
  screenshotRect: ScreenshotRect | null;
  laserStrokes: any[];
  selectedStrokeIds: Set<string>;
  drawTick: number;
}

/**
 * Renders a single document page inside a Konva Group:
 * shadow/background → grid/PDF background → drawing layers → active stroke → laser strokes.
 */
export const PageView: React.FC<PageViewProps> = ({
  page, pageIndex, offsetY,
  activePageIndex, isDrawing, activeTool,
  // drawTick is intentionally unused here — its only purpose is to be part of props
  // so React re-renders this component on every mousemove while drawing.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toolInstances, lassoPoints, screenshotRect, laserStrokes, selectedStrokeIds, drawTick,
}) => {
  return (
    <Group key={page.id || pageIndex} y={offsetY}>
      {/* Page shadow + white background */}
      <Rect
        x={0} y={0}
        width={page.width} height={page.height}
        fill="#ffffff"
        shadowColor="black" shadowBlur={10} shadowOpacity={0.3}
        shadowOffset={{ x: 2, y: 2 }}
      />

      {/* Solid colour / grid background */}
      {page.background?.type === 'solid' && (
        <Group>
          <Rect width={page.width} height={page.height} fill={page.background.color} />
          <GridLayer width={page.width} height={page.height} style={page.background.style} />
        </Group>
      )}

      {/* PDF background */}
      {page.background?.type === 'pdf' && (
        <PdfLayer
          filename={page.background.filename}
          pageno={page.background.pageno}
          width={page.width}
          height={page.height}
        />
      )}

      {/* Drawing layers */}
      {page.layers.map((layer, lIndex) => {
        if (layer.visible === false) return null;
        return (
          <Group key={layer.id || `layer-${lIndex}`}>
            {layer.elements.map((el) => {
              const isSelected = selectedStrokeIds.has(el.id);
              const selColor = '#4CAF50';
              const selShadow = isSelected ? { shadowColor: selColor, shadowBlur: 6, shadowOpacity: 0.9 } : {};

              if ('points' in el) {
                return (
                  <PressureLine
                    key={el.id}
                    stroke={el}
                    isSelected={isSelected}
                  />
                );
              }
              if (el.type === 'image') {
                return <PastedImage key={el.id} element={el} isSelected={isSelected} activeTool={activeTool} pageIndex={pageIndex} />;
              }
              if (el.type === 'text') {
                return (
                  <KonvaText
                    key={el.id}
                    x={el.x} y={el.y}
                    text={el.text}
                    fontSize={el.size}
                    fill={isSelected ? selColor : el.color}
                    fontFamily={el.font}
                  />
                );
              }
              if (el.type === 'rect') {
                const r = el as RectElement;
                return (
                  <React.Fragment key={el.id}>
                    <Rect
                      x={r.x} y={r.y}
                      width={r.width} height={r.height}
                      stroke={isSelected ? selColor : r.color}
                      fill={r.fillColor && r.fillColor !== 'transparent' ? r.fillColor : undefined}
                      strokeWidth={r.strokeWidth}
                      cornerRadius={2}
                      listening={false}
                      {...selShadow}
                    />
                    {isSelected && activeTool === 'selection' && (
                      <ShapeHandles element={r} pageIndex={pageIndex} />
                    )}
                  </React.Fragment>
                );
              }
              if (el.type === 'line') {
                const ln = el as LineElement;
                return (
                  <React.Fragment key={el.id}>
                    <Line
                      points={[ln.x1, ln.y1, ln.x2, ln.y2]}
                      stroke={isSelected ? selColor : ln.color}
                      strokeWidth={ln.strokeWidth}
                      lineCap="round"
                      listening={false}
                      {...selShadow}
                    />
                    {isSelected && activeTool === 'selection' && (
                      <ShapeHandles element={ln} pageIndex={pageIndex} />
                    )}
                  </React.Fragment>
                );
              }
              if (el.type === 'circle') {
                const c = el as CircleElement;
                return (
                  <React.Fragment key={el.id}>
                    <KonvaCircle
                      x={c.cx} y={c.cy} radius={c.r}
                      stroke={isSelected ? selColor : c.color}
                      fill={c.fillColor && c.fillColor !== 'transparent' ? c.fillColor : undefined}
                      strokeWidth={c.strokeWidth}
                      listening={false}
                      {...selShadow}
                    />
                    {isSelected && activeTool === 'selection' && (
                      <ShapeHandles element={c} pageIndex={pageIndex} />
                    )}
                  </React.Fragment>
                );
              }
              if (el.type === 'triangle') {
                const t = el as TriangleElement;
                return (
                  <React.Fragment key={el.id}>
                    <Line
                      points={[t.x1, t.y1, t.x2, t.y2, t.x3, t.y3]}
                      stroke={isSelected ? selColor : t.color}
                      fill={t.fillColor && t.fillColor !== 'transparent' ? t.fillColor : undefined}
                      strokeWidth={t.strokeWidth}
                      lineCap="round" lineJoin="round"
                      closed
                      listening={false}
                      {...selShadow}
                    />
                    {isSelected && activeTool === 'selection' && (
                      <ShapeHandles element={t} pageIndex={pageIndex} />
                    )}
                  </React.Fragment>
                );
              }
              return null;
            })}
          </Group>
        );
      })}

      {/* Active stroke + lasso overlay (current page only) */}
      {isDrawing && activePageIndex === pageIndex && (
        <>
          {toolInstances[activeTool]?.getActiveStroke && (
            <PressureLine
              stroke={toolInstances[activeTool].getActiveStroke()}
              isSelected={false}
            />
          )}
          {activeTool === 'selection' && lassoPoints.length > 1 && (
            <Line
              points={lassoPoints.flatMap(p => [p.x, p.y])}
              stroke="#4CAF50"
              strokeWidth={1.5 / 1}
              dash={[6, 4]}
              closed={true}
              listening={false}
            />
          )}
          {activeTool === 'screenshot' && screenshotRect && screenshotRect.width > 0 && (
            <Rect
              x={screenshotRect.x} y={screenshotRect.y}
              width={screenshotRect.width} height={screenshotRect.height}
              stroke="#2196F3"
              strokeWidth={1.5}
              dash={[6, 4]}
              fill="rgba(33,150,243,0.05)"
              listening={false}
            />
          )}
        </>
      )}

      {/* Laser pointer strokes */}
      {laserStrokes.map((s, idx) => {
        const age = Date.now() - s.startTime;
        const opacity = Math.max(0, 1 - age / 1500);
        return (
          <Line
            key={`laser-${idx}`}
            points={s.points.flatMap((p: any) => [p.x, p.y])}
            stroke="red" strokeWidth={3}
            lineCap="round" lineJoin="round"
            opacity={opacity}
            shadowColor="red" shadowBlur={10}
          />
        );
      })}
    </Group>
  );
};
