import React from 'react';
import { Shape } from 'react-konva';
import { Stroke } from '../../types/xopp';

interface PressureLineProps {
  stroke: Stroke;
  isSelected: boolean;
}

export const PressureLine: React.FC<PressureLineProps> = ({ stroke, isSelected }) => {
  // Highlighter strokes use a whole-shape opacity so overlapping segments
  // don't stack their transparency. Pen/eraser stay fully opaque.
  const shapeOpacity = stroke.tool === 'highlighter' ? 0.15 : 1;

  return (
    <Shape
      listening={false}
      opacity={shapeOpacity}
      sceneFunc={(context, shape) => {
        if (stroke.points.length < 2) return;

        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.strokeStyle = isSelected ? '#4CAF50' : stroke.color;
        
        if (isSelected) {
          context.shadowColor = '#4CAF50';
          context.shadowBlur = 5;
        }

        // Draw segments with varying widths
        // We smooth the pressure to avoid jagged transitions
        const getSmoothedPressure = (index: number) => {
          const p = stroke.points[index].pressure ?? 0.5;
          // Simple smoothing: average with neighbors
          let sum = p;
          let count = 1;
          if (index > 0) {
            sum += stroke.points[index - 1].pressure ?? 0.5;
            count++;
          }
          if (index < stroke.points.length - 1) {
            sum += stroke.points[index + 1].pressure ?? 0.5;
            count++;
          }
          return sum / count;
        };

        for (let i = 0; i < stroke.points.length - 1; i++) {
          const p1 = stroke.points[i];
          const p2 = stroke.points[i + 1];
          
          const pressure1 = getSmoothedPressure(i);
          const pressure2 = getSmoothedPressure(i + 1);
          const avgPressure = (pressure1 + pressure2) / 2;
          
          // Width modulation: base width * (0.4 + pressure * 1.2)
          // This gives a nice range from 40% to 160% of base width
          const width = stroke.width * (0.4 + avgPressure * 1.2);
          
          context.beginPath();
          context.moveTo(p1.x, p1.y);
          context.lineTo(p2.x, p2.y);
          context.lineWidth = width;
          context.stroke();
        }
      }}
      hitFunc={(context, shape) => {
        context.beginPath();
        for (let i = 0; i < stroke.points.length; i++) {
          const p = stroke.points[i];
          if (i === 0) context.moveTo(p.x, p.y);
          else context.lineTo(p.x, p.y);
        }
        context.lineWidth = stroke.width + 10;
        context.strokeShape(shape);
      }}
    />
  );
};
