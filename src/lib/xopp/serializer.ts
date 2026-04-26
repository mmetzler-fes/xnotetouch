import pako from 'pako';
import { XoppDocument } from '../../types/xopp';

export function serializeXopp(doc: XoppDocument): Uint8Array {
  let xml = `<?xml version="1.0" standalone="no"?>\n`;
  xml += `<xournal version="${doc.version}" creator="${doc.creator}">\n`;
  xml += `  <title>${doc.title}</title>\n`;

  for (const page of doc.pages) {
    xml += `  <page width="${page.width}" height="${page.height}">\n`;
    
    if (page.background) {
      if (page.background.type === 'pdf') {
        xml += `    <background type="pdf" domain="${page.background.domain}" filename="${page.background.filename}" pageno="${page.background.pageno}"/>\n`;
      } else if (page.background.type === 'solid') {
        xml += `    <background type="solid" color="${page.background.color}" style="${page.background.style}"/>\n`;
      }
    }

    for (const layer of page.layers) {
      xml += `    <layer>\n`;
      for (const el of layer.elements) {
        if ('points' in el) {
          const coords = el.points.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
          xml += `      <stroke tool="${el.tool}" color="${el.color}" width="${el.width}" capStyle="${el.capStyle}">\n`;
          xml += `        ${coords}\n`;
          xml += `      </stroke>\n`;
        } else if (el.type === 'image') {
          xml += `      <image x="${el.x.toFixed(2)}" y="${el.y.toFixed(2)}" width="${el.width.toFixed(2)}" height="${el.height.toFixed(2)}"><![CDATA[${el.dataUrl}]]></image>\n`;
        } else if (el.type === 'text') {
          const escaped = el.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          xml += `      <text x="${el.x.toFixed(2)}" y="${el.y.toFixed(2)}" font="${el.font}" size="${el.size}" color="${el.color}">${escaped}</text>\n`;
        } else if (el.type === 'rect') {
          xml += `      <rect x="${el.x.toFixed(2)}" y="${el.y.toFixed(2)}" width="${el.width.toFixed(2)}" height="${el.height.toFixed(2)}" color="${el.color}" fillColor="${el.fillColor ?? 'transparent'}" strokeWidth="${el.strokeWidth}"/>\n`;
        } else if (el.type === 'line') {
          xml += `      <line x1="${el.x1.toFixed(2)}" y1="${el.y1.toFixed(2)}" x2="${el.x2.toFixed(2)}" y2="${el.y2.toFixed(2)}" color="${el.color}" strokeWidth="${el.strokeWidth}"/>\n`;
        } else if (el.type === 'circle') {
          xml += `      <circle cx="${el.cx.toFixed(2)}" cy="${el.cy.toFixed(2)}" r="${el.r.toFixed(2)}" color="${el.color}" fillColor="${el.fillColor ?? 'transparent'}" strokeWidth="${el.strokeWidth}"/>\n`;
        } else if (el.type === 'triangle') {
          xml += `      <triangle x1="${el.x1.toFixed(2)}" y1="${el.y1.toFixed(2)}" x2="${el.x2.toFixed(2)}" y2="${el.y2.toFixed(2)}" x3="${el.x3.toFixed(2)}" y3="${el.y3.toFixed(2)}" color="${el.color}" fillColor="${el.fillColor ?? 'transparent'}" strokeWidth="${el.strokeWidth}"/>\n`;
        }
      }
      xml += `    </layer>\n`;
    }
    xml += `  </page>\n`;
  }
  
  xml += `</xournal>`;

  return pako.deflate(xml);
}
