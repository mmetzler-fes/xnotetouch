import React from 'react';
import { Layer, Line, Rect } from 'react-konva';

interface GridLayerProps {
  width: number;
  height: number;
  style: 'plain' | 'graph' | 'lined' | 'ruled' | 'staves';
  color?: string;
}

export const GridLayer: React.FC<GridLayerProps> = ({ width, height, style, color = '#ffffffff' }) => {
  // Parse Xournal++ hex color (e.g., #ffffffff) to standard hex or rgba for Konva
  let bgColor = color;
  if (color.length === 9) {
    // #RRGGBBAA to rgba
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const a = parseInt(color.slice(7, 9), 16) / 255;
    bgColor = `rgba(${r},${g},${b},${a})`;
  }

  const lines = [];
  const gridSize = 14.17; // Roughly 5mm in points at 72dpi

  if (style === 'graph') {
    // Vertical lines
    for (let x = 0; x < width; x += gridSize) {
      lines.push(
        <Line key={`v-${x}`} points={[x, 0, x, height]} stroke="#a0ccff" strokeWidth={0.5} />
      );
    }
    // Horizontal lines
    for (let y = 0; y < height; y += gridSize) {
      lines.push(
        <Line key={`h-${y}`} points={[0, y, width, y]} stroke="#a0ccff" strokeWidth={0.5} />
      );
    }
  }

  return (
    <>
      {lines}
    </>
  );
};
