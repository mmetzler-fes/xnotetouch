import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const loadPdf = async (buffer: ArrayBuffer) => {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdfDoc = await loadingTask.promise;
  
  // Get dimensions of the first page to use as default
  const firstPage = await pdfDoc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.0 });
  
  return {
    pdfDoc,
    numPages: pdfDoc.numPages,
    width: viewport.width,
    height: viewport.height
  };
};

export const renderPdfPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, targetWidth: number, targetHeight: number) => {
  const page = await pdfDoc.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale: 1.0 });
  const scaleX = targetWidth / viewport.width;
  const scaleY = targetHeight / viewport.height;
  
  // Use explicit transform to ensure correct stretching without mirroring
  const scaledViewport = page.getViewport({ 
    scale: 1, 
    transform: [scaleX, 0, 0, scaleY, 0, 0] 
  } as any);

  canvas.height = targetHeight;
  canvas.width = targetWidth;

  const renderContext = {
    canvasContext: canvas.getContext('2d')!,
    viewport: scaledViewport,
  };

  await page.render(renderContext).promise;
  return canvas.toDataURL('image/png'); // Return base64 to be used in Konva Image
};
