import jsPDF from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import { useDocumentStore } from '../../stores/documentStore';
import { loadPdf, renderPdfPage } from './renderer';
import Konva from 'konva';

export const exportToPdf = async () => {
  const { documents, activeDocumentIndex } = useDocumentStore.getState();
  const document = documents[activeDocumentIndex];
  
  if (!document || document.pages.length === 0) {
    console.error("No document or pages to export");
    return;
  }

  // Cache for PDF documents to avoid redundant loading
  const pdfCache = new Map<string, any>();

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    for (let i = 0; i < document.pages.length; i++) {
      const page = document.pages[i];
      
      const container = window.document.createElement('div');
      const stage = new Konva.Stage({
        container: container,
        width: page.width,
        height: page.height,
      });

      const layer = new Konva.Layer();
      stage.add(layer);

      // 1. White background
      layer.add(new Konva.Rect({
        x: 0, y: 0, width: page.width, height: page.height, fill: 'white'
      }));

      // 2. Page background (PDF or Solid)
      if (page.background?.type === 'pdf') {
        try {
          let pdfProxy = pdfCache.get(page.background.filename);
          if (!pdfProxy) {
            const pdfBytes = await readFile(page.background.filename);
            const loaded = await loadPdf(pdfBytes.buffer as ArrayBuffer);
            pdfProxy = loaded.pdfDoc;
            pdfCache.set(page.background.filename, pdfProxy);
          }

          const tempCanvas = window.document.createElement('canvas');
          const dataUrl = await renderPdfPage(pdfProxy, page.background.pageno, tempCanvas, page.width, page.height);
          
          const img = await new Promise<HTMLImageElement>((resolve) => {
            const image = new window.Image();
            image.src = dataUrl;
            image.onload = () => resolve(image);
          });

          layer.add(new Konva.Image({
            image: img,
            width: page.width,
            height: page.height
          }));
        } catch (e) {
          console.error("Failed to render PDF background for export:", e);
        }
      } else if (page.background?.type === 'solid') {
        layer.add(new Konva.Rect({
          x: 0, y: 0, width: page.width, height: page.height, fill: page.background.color
        }));
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
