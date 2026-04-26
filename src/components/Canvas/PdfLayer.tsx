import React, { useEffect, useState, useRef } from 'react';
import { Image as KonvaImage } from 'react-konva';
import { loadPdf, renderPdfPage } from '../../lib/pdf/renderer';

interface PdfLayerProps {
  filename: string;
  pageno: number;
  width: number;
  height: number;
}

export const PdfLayer: React.FC<PdfLayerProps> = ({ filename, pageno, width, height }) => {
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    console.log(`PdfLayer: Requesting render for ${filename} page ${pageno}`);
    
    const fetchPdf = async () => {
      try {
        let pdfBytes: Uint8Array | null = null;
        if (filename.startsWith('data:application/pdf;base64,')) {
          const base64 = filename.split(',')[1];
          const binaryString = atob(base64);
          pdfBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i);
          }
        } else if (filename && (typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || typeof (window as any).__TAURI__ !== 'undefined')) {
          // Nur in Tauri: Datei vom Dateisystem laden
          const { readFile } = await import('@tauri-apps/plugin-fs');
          pdfBytes = await readFile(filename);
        } else {
          // Im Browser: Kann PDF nicht nachladen, zeige Warnung
          console.warn('PDF kann im Browser nicht vom Dateisystem geladen werden:', filename);
          return;
        }

        if (pdfBytes && isMounted) {
          const { pdfDoc } = await loadPdf(pdfBytes.buffer as ArrayBuffer);
          const hiddenCanvas = document.createElement('canvas');
          const dataUrl = await renderPdfPage(pdfDoc, pageno, hiddenCanvas, width, height);
          
          if (!isMounted) return;

          const img = new window.Image();
          img.src = dataUrl;
          img.onload = () => {
            if (isMounted) {
              setImgObj(img);
            }
          };
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to render PDF page:", err);
        }
      }
    };
    
    fetchPdf();
    return () => { isMounted = false; };
  }, [filename, pageno]);

  if (!imgObj) return null;

  return (
    <KonvaImage 
      image={imgObj} 
      width={width} 
      height={height} 
      listening={false} // Click-through to drawing layer
    />
  );
};
