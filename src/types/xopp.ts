export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'text';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  width: number;
  points: Point[];
  capStyle: 'butt' | 'round' | 'square';
}

export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string; // base64 string
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  font: string;
  size: number;
  color: string;
}

export type LayerElement = Stroke | ImageElement | TextElement;

export interface Layer {
  id: string;
  type: 'drawing';
  elements: LayerElement[];
  visible?: boolean;
}

export interface PdfBackground {
  type: 'pdf';
  domain: 'absolute' | 'attach';
  filename: string;
  pageno: number;
  data?: string; // base64 if embedded
}

export interface SolidBackground {
  type: 'solid';
  color: string;
  style: 'plain' | 'lined' | 'ruled' | 'graph' | 'staves';
}

export type PageBackground = PdfBackground | SolidBackground;

export interface Page {
  id: string;
  width: number;
  height: number;
  background?: PageBackground;
  layers: Layer[];
}

export interface XoppDocument {
  version: string;
  creator: string;
  title: string;
  pages: Page[];
}
