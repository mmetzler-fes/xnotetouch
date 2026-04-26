import { Tool, ToolContext } from './Tool';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { ImageElement } from '../../types/xopp';

export class ImageTool extends Tool {
  readonly type = 'image';

  async onMouseDown(x: number, y: number, pressure: number, ctx: ToolContext) {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }]
      });

      if (typeof selected === 'string') {
        const fileData = await readFile(selected);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileData)));
        const dataUrl = `data:image/${selected.split('.').pop()};base64,${base64}`;

        // Create a temporary image to get dimensions
        const img = new Image();
        img.onload = () => {
          const newElement: ImageElement = {
            id: `img-${Date.now()}`,
            type: 'image',
            x,
            y,
            width: img.width,
            height: img.height,
            dataUrl
          };
          ctx.addElement(newElement);
        };
        img.src = dataUrl;
      }
    } catch (e) {
      console.error('Failed to add image', e);
    }
  }
}
