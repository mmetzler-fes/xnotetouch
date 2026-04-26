import pako from 'pako';
import { XoppDocument, Page, Layer, Stroke, ToolType, ImageElement, TextElement, RectElement, LineElement, CircleElement, TriangleElement } from '../../types/xopp';

export function parseXopp(buffer: Uint8Array | ArrayBuffer | string, filePath?: string): XoppDocument {
  let xmlString: string;
  
  // Handle different input types
  if (typeof buffer === 'string') {
    // Already a string, possibly plain XML or need decompression check
    xmlString = buffer;
    // Try to detect if it's compressed by checking if it starts with valid XML
    if (!xmlString.trim().startsWith('<?xml') && !xmlString.trim().startsWith('<xournal')) {
      try {
        // Might be compressed, try to decompress
        const uint8Array = new TextEncoder().encode(xmlString);
        xmlString = pako.inflate(uint8Array, { to: 'string' });
      } catch (e) {
        // If decompression fails, assume it's already plain XML
      }
    }
  } else {
    // Convert to Uint8Array if needed
    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    // 1. Decompress GZIP
    xmlString = pako.inflate(uint8Array, { to: 'string' });
  }
  
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

      // --- image elements ---
      const imageEls = layerEl.getElementsByTagName('image');
      for (let iIdx = 0; iIdx < imageEls.length; iIdx++) {
        const imgEl = imageEls[iIdx];
        const dataUrl = imgEl.textContent?.trim() || '';
        if (!dataUrl) continue;
        layer.elements.push({
          id: `image-${pIndex}-${childIdx}-${iIdx}`,
          type: 'image',
          x: parseFloat(imgEl.getAttribute('x') || '0'),
          y: parseFloat(imgEl.getAttribute('y') || '0'),
          width: parseFloat(imgEl.getAttribute('width') || '100'),
          height: parseFloat(imgEl.getAttribute('height') || '100'),
          dataUrl,
        } as ImageElement);
      }

      // --- text elements ---
      const textEls = layerEl.getElementsByTagName('text');
      for (let tIdx = 0; tIdx < textEls.length; tIdx++) {
        const textEl = textEls[tIdx];
        layer.elements.push({
          id: `text-${pIndex}-${childIdx}-${tIdx}`,
          type: 'text',
          x: parseFloat(textEl.getAttribute('x') || '0'),
          y: parseFloat(textEl.getAttribute('y') || '0'),
          text: textEl.textContent || '',
          font: textEl.getAttribute('font') || 'Sans',
          size: parseFloat(textEl.getAttribute('size') || '12'),
          color: textEl.getAttribute('color') || '#000000ff',
        } as TextElement);
      }

      // --- rect elements ---
      const rectEls = layerEl.getElementsByTagName('rect');
      for (let rIdx = 0; rIdx < rectEls.length; rIdx++) {
        const rectEl = rectEls[rIdx];
        layer.elements.push({
          id: `rect-${pIndex}-${childIdx}-${rIdx}`,
          type: 'rect',
          x: parseFloat(rectEl.getAttribute('x') || '0'),
          y: parseFloat(rectEl.getAttribute('y') || '0'),
          width: parseFloat(rectEl.getAttribute('width') || '0'),
          height: parseFloat(rectEl.getAttribute('height') || '0'),
          color: rectEl.getAttribute('color') || '#000000ff',
          fillColor: rectEl.getAttribute('fillColor') || 'transparent',
          strokeWidth: parseFloat(rectEl.getAttribute('strokeWidth') || '2'),
        } as RectElement);
      }

      // --- line elements ---
      const lineEls = layerEl.getElementsByTagName('line');
      for (let lIdx = 0; lIdx < lineEls.length; lIdx++) {
        const lineEl = lineEls[lIdx];
        layer.elements.push({
          id: `line-${pIndex}-${childIdx}-${lIdx}`,
          type: 'line',
          x1: parseFloat(lineEl.getAttribute('x1') || '0'),
          y1: parseFloat(lineEl.getAttribute('y1') || '0'),
          x2: parseFloat(lineEl.getAttribute('x2') || '0'),
          y2: parseFloat(lineEl.getAttribute('y2') || '0'),
          color: lineEl.getAttribute('color') || '#000000ff',
          strokeWidth: parseFloat(lineEl.getAttribute('strokeWidth') || '2'),
        } as LineElement);
      }

      // --- circle elements ---
      const circleEls = layerEl.getElementsByTagName('circle');
      for (let cIdx = 0; cIdx < circleEls.length; cIdx++) {
        const circleEl = circleEls[cIdx];
        layer.elements.push({
          id: `circle-${pIndex}-${childIdx}-${cIdx}`,
          type: 'circle',
          cx: parseFloat(circleEl.getAttribute('cx') || '0'),
          cy: parseFloat(circleEl.getAttribute('cy') || '0'),
          r: parseFloat(circleEl.getAttribute('r') || '0'),
          color: circleEl.getAttribute('color') || '#000000ff',
          fillColor: circleEl.getAttribute('fillColor') || 'transparent',
          strokeWidth: parseFloat(circleEl.getAttribute('strokeWidth') || '2'),
        } as CircleElement);
      }

      // --- triangle elements ---
      const triEls = layerEl.getElementsByTagName('triangle');
      for (let tIdx = 0; tIdx < triEls.length; tIdx++) {
        const triEl = triEls[tIdx];
        layer.elements.push({
          id: `triangle-${pIndex}-${childIdx}-${tIdx}`,
          type: 'triangle',
          x1: parseFloat(triEl.getAttribute('x1') || '0'), y1: parseFloat(triEl.getAttribute('y1') || '0'),
          x2: parseFloat(triEl.getAttribute('x2') || '0'), y2: parseFloat(triEl.getAttribute('y2') || '0'),
          x3: parseFloat(triEl.getAttribute('x3') || '0'), y3: parseFloat(triEl.getAttribute('y3') || '0'),
          color: triEl.getAttribute('color') || '#000000ff',
          fillColor: triEl.getAttribute('fillColor') || 'transparent',
          strokeWidth: parseFloat(triEl.getAttribute('strokeWidth') || '2'),
        } as TriangleElement);
      }
      page.layers.push(layer);
    }

    doc.pages.push(page);
  }

  console.log(`Parser: Finished parsing ${doc.pages.length} pages.`);
  return doc;
}
