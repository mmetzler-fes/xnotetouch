import jsPDF from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useDocumentStore } from '../../stores/documentStore';
import Konva from 'konva';

export const exportToPdf = async () => {
  const { documents, activeDocumentIndex } = useDocumentStore.getState();
  const document = documents[activeDocumentIndex];
  
  if (!document || document.pages.length === 0) {
    console.error("No document or pages to export");
    return;
  }

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt', // Using points for consistency with XOPP
      format: 'a4'
    });

    for (let i = 0; i < document.pages.length; i++) {
      const page = document.pages[i];
      
      // Create off-screen stage for rendering
      const container = window.document.createElement('div');
      const stage = new Konva.Stage({
        container: container,
        width: page.width,
        height: page.height,
      });

      const layer = new Konva.Layer();
      stage.add(layer);

      // 1. White background
      const bgRect = new Konva.Rect({
        x: 0, y: 0, width: page.width, height: page.height, fill: 'white'
      });
      layer.add(bgRect);

      // 2. Page background (PDF or Solid)
      // Note: PDF background rendering is complex because it's async (PDF.js)
      // For now, we only render solid backgrounds and strokes.
      // TODO: Implement PDF background rendering in exporter if needed.
      if (page.background?.type === 'solid') {
        const solidBg = new Konva.Rect({
          x: 0, y: 0, width: page.width, height: page.height, fill: page.background.color
        });
        layer.add(solidBg);
      }

      // 3. Drawing Layers
      for (const drawingLayer of page.layers) {
        if (drawingLayer.visible === false) continue;
        
        for (const el of drawingLayer.elements) {
          if ('points' in el) {
            // Render stroke
            // We use a simplified rendering here (Lines) or a custom Shape for pressure
            // For export, standard Line is often enough unless pressure is critical
            const line = new Konva.Line({
              points: el.points.flatMap(p => [p.x, p.y]),
              stroke: el.color,
              strokeWidth: el.width,
              lineCap: 'round',
              lineJoin: 'round',
              tension: 0.2
            });
            layer.add(line);
          } else if (el.type === 'text') {
            const text = new Konva.Text({
              x: el.x, y: el.y, text: el.text, fontSize: el.size, fill: el.color, fontFamily: el.font
            });
            layer.add(text);
          }
        }
      }

      layer.draw();
      
      // Rasterize page
      const dataUrl = stage.toDataURL({ pixelRatio: 2 }); // High quality

      if (i > 0) pdf.addPage();
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Cleanup
      stage.destroy();
    }

    // Save dialog
    const selected = await save({
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (typeof selected === 'string') {
      const pdfArrayBuffer = pdf.output('arraybuffer');
      await writeFile(selected, new Uint8Array(pdfArrayBuffer));
    }
  } catch (err) {
    console.error("Failed to export PDF:", err);
  }
};
