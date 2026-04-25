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
          // Xournal++ image serialization would go here, omitting for simplicity in basic MVP
        }
      }
      xml += `    </layer>\n`;
    }
    xml += `  </page>\n`;
  }
  
  xml += `</xournal>`;

  return pako.deflate(xml);
}
