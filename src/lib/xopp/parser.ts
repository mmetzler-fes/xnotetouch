import pako from 'pako';
import { XoppDocument, Page, Layer, Stroke, ToolType } from '../../types/xopp';

export function parseXopp(buffer: Uint8Array, filePath?: string): XoppDocument {
  // 1. Decompress GZIP
  const xmlString = pako.inflate(buffer, { to: 'string' });
  
  // 2. Parse XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  const xournal = xmlDoc.getElementsByTagName('xournal')[0];
  if (!xournal) throw new Error("Invalid .xopp file (no xournal tag found)");

  // Prioritize filename from filePath over internal XML title
  let title = '';
  if (filePath) {
    const fullFileName = filePath.split(/[/\\]/).pop() || '';
    const lastDotIndex = fullFileName.lastIndexOf('.');
    title = lastDotIndex !== -1 ? fullFileName.substring(0, lastDotIndex) : fullFileName;
  }

  // Fallback to XML title or default if no filePath
  if (!title) {
    title = xmlDoc.getElementsByTagName('title')[0]?.textContent?.trim() || 'Unbenanntes Dokument';
  }

  const doc: XoppDocument = {
    version: xournal.getAttribute('version') || '0.4.8',
    creator: xournal.getAttribute('creator') || 'XNoteTouch',
    title,
    pages: [],
    filePath
  };

  const pages = xmlDoc.getElementsByTagName('page');
  console.log(`Parser: Found ${pages.length} pages in .xopp file via getElementsByTagName`);
  
  let lastPdfPath = '';
  const startTime = Date.now();
  for (let pIndex = 0; pIndex < pages.length; pIndex++) {
    const pageEl = pages[pIndex];
    const page: Page = {
      id: `page-${startTime}-${pIndex}`,
      width: parseFloat(pageEl.getAttribute('width') || '595.27'),
      height: parseFloat(pageEl.getAttribute('height') || '841.89'),
      layers: []
    };

    let bgEl: Element | null = null;
    const childrenTags = [];
    for (let i = 0; i < pageEl.children.length; i++) {
      const child = pageEl.children[i];
      childrenTags.push(child.tagName);
      if (child.tagName.toLowerCase() === 'background') {
        bgEl = child;
        break;
      }
    }
    
    if (bgEl) {
      const bgType = bgEl.getAttribute('type');
      if (bgType === 'pdf') {
        let pdfPath = bgEl.getAttribute('filename') || lastPdfPath;
        
        // Resolve relative path if filePath is provided and it's a new path
        if (pdfPath !== lastPdfPath && filePath && pdfPath && !pdfPath.startsWith('data:') && !pdfPath.startsWith('/') && !pdfPath.includes(':')) {
           const sepIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
           if (sepIndex !== -1) pdfPath = filePath.substring(0, sepIndex + 1) + pdfPath;
        }
        
        // Normalize
        if (pdfPath !== lastPdfPath && pdfPath.includes('..')) {
           const parts = pdfPath.split(/[/\\]/);
           const stack = [];
           for (const part of parts) {
             if (part === '..') stack.pop(); else if (part !== '.') stack.push(part);
           }
           pdfPath = (pdfPath.startsWith('/') ? '/' : '') + stack.join('/');
        }

        lastPdfPath = pdfPath;

        const pagenoAttr = bgEl.getAttribute('pageno');
        const pageno = pagenoAttr ? parseInt(pagenoAttr) : 1;

        page.background = {
          type: 'pdf',
          domain: bgEl.getAttribute('domain') as any || 'absolute',
          filename: pdfPath,
          pageno: pageno
        };
      } else if (bgType === 'solid') {
        page.background = {
          type: 'solid',
          color: bgEl.getAttribute('color') || '#ffffffff',
          style: (bgEl.getAttribute('style') || 'plain') as any
        };
      }
    }

    for (let childIdx = 0; childIdx < pageEl.children.length; childIdx++) {
      if (pageEl.children[childIdx].tagName.toLowerCase() !== 'layer') continue;
      const layerEl = pageEl.children[childIdx];
      const layer: Layer = {
        id: `layer-${pIndex}-${childIdx}`,
        type: 'drawing',
        elements: []
      };

      const strokeEls = layerEl.getElementsByTagName('stroke');
      for (let sIndex = 0; sIndex < strokeEls.length; sIndex++) {
        const strokeEl = strokeEls[sIndex];
        const textContent = strokeEl.textContent?.trim() || '';
        const coords = textContent.split(/\s+/).map(Number);
        const points = [];
        for (let j = 0; j < coords.length; j += 2) {
          if (!isNaN(coords[j]) && !isNaN(coords[j+1])) {
            points.push({ x: coords[j], y: coords[j+1], pressure: 0.5 });
          }
        }

        layer.elements.push({
          id: `stroke-${pIndex}-${childIdx}-${sIndex}`,
          type: undefined,
          tool: (strokeEl.getAttribute('tool') || 'pen') as ToolType,
          color: strokeEl.getAttribute('color') || '#000000ff',
          width: parseFloat(strokeEl.getAttribute('width') || '1.41'),
          capStyle: (strokeEl.getAttribute('capStyle') || 'round') as any,
          points
        } as any);
      }
      page.layers.push(layer);
    }

    doc.pages.push(page);
  }

  console.log(`Parser: Finished parsing ${doc.pages.length} pages.`);
  return doc;
}
