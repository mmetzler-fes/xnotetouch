import React, { useRef } from 'react';
import { useToolStore } from '../../stores/toolStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';
import { 
  Pen, 
  Highlighter, 
  Eraser, 
  Undo, 
  Redo, 
  Grid3X3, 
  MousePointer2, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Shapes,
  Zap,
  Image as ImageIcon,
  Camera
} from 'lucide-react';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const { activeTool, color, fillColor, highlighterColor, strokeWidth, highlighterStrokeWidth, setTool, setColor, setFillColor, setHighlighterColor, setStrokeWidth, setHighlighterStrokeWidth } = useToolStore();
  const { setPendingInsertImage } = useUiStore();
  const lastFillColorRef = useRef(fillColor === 'transparent' ? '#ff0000' : fillColor.substring(0, 7));
  const isTransparent = fillColor === 'transparent';
  const isHighlighter = activeTool === 'highlighter';
  // Use the right stroke width for the active tool
  const activeStrokeWidth = isHighlighter ? highlighterStrokeWidth : strokeWidth;
  const setActiveStrokeWidth = isHighlighter ? setHighlighterStrokeWidth : setStrokeWidth;

  const handleFillColorChange = (hex: string) => {
    lastFillColorRef.current = hex;
    setFillColor(hex);
  };

  const toggleTransparent = () => {
    if (isTransparent) {
      setFillColor(lastFillColorRef.current);
    } else {
      lastFillColorRef.current = fillColor.substring(0, 7);
      setFillColor('transparent');
    }
  };
  const { 
    documents, 
    activeDocumentIndex, 
    activePageIndex, 
    addPage, 
    nextPage, 
    prevPage,
    undo,
    redo,
    past,
    future,
    setPageBackground
  } = useDocumentStore();
  
  const document = documents[activeDocumentIndex];

  const toggleBackground = () => {
    const activePage = document?.pages[activePageIndex];
    if (activePage?.background?.type === 'solid') {
      const newStyle = activePage.background.style === 'plain' ? 'graph' : 'plain';
      setPageBackground(newStyle);
    } else {
      setPageBackground('graph');
    }
  };

  const openImagePicker = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (typeof selected !== 'string') return;
      const ext = selected.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };
      const mime = mimeMap[ext] || 'png';
      const fileData = await readFile(selected);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(fileData)));
      const dataUrl = `data:image/${mime};base64,${base64}`;
      const img = new Image();
      img.onload = () => {
        setPendingInsertImage({ dataUrl, width: img.width, height: img.height });
        setTool('selection');
      };
      img.src = dataUrl;
    } catch (e) {
      console.error('Bild öffnen fehlgeschlagen', e);
    }
  };

  return (
    <div className="toolbar-container">
      <div className="tool-group">
        <button className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Stift"><Pen size={20} /></button>
        <button className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Radierer"><Eraser size={20} /></button>
        <button className={`tool-btn ${activeTool === 'highlighter' ? 'active' : ''}`} onClick={() => setTool('highlighter')} title="Textmarker"><Highlighter size={20} /></button>
        <button className={`tool-btn ${activeTool === 'shape' ? 'active' : ''}`} onClick={() => setTool('shape')} title="Formenerkennung (Rechteck, Linie)"><Shapes size={20} /></button>
        <button className={`tool-btn ${activeTool === 'selection' ? 'active' : ''}`} onClick={() => setTool('selection')} title="Auswahl Tool"><MousePointer2 size={20} /></button>
        <button className={`tool-btn ${activeTool === 'image' ? 'active' : ''}`} onClick={openImagePicker} title="Bild einfügen"><ImageIcon size={20} /></button>
        <button className={`tool-btn ${activeTool === 'screenshot' ? 'active' : ''}`} onClick={() => setTool('screenshot')} title="Bildschirmausschnitt"><Camera size={20} /></button>
        <button className={`tool-btn ${activeTool === 'laser' ? 'active' : ''}`} onClick={() => setTool('laser')} title="Laserpointer"><Zap size={20} /></button>
      </div>

      <div className="tool-group separator">
        <div className="thickness-selector">
          <button className={`thickness-btn ${activeStrokeWidth <= 1.5 ? 'active' : ''}`} onClick={() => setActiveStrokeWidth(1.41)} title="Klein">S</button>
          <button className={`thickness-btn ${activeStrokeWidth > 1.5 && activeStrokeWidth <= 3 ? 'active' : ''}`} onClick={() => setActiveStrokeWidth(2.5)} title="Mittel">M</button>
          <button className={`thickness-btn ${activeStrokeWidth > 3 ? 'active' : ''}`} onClick={() => setActiveStrokeWidth(5)} title="Dick">L</button>
        </div>
      </div>

      <div className="tool-group separator">
        <div className="color-selectors">
            <div className="color-picker-wrapper" title={isHighlighter ? 'Textmarkerfarbe' : 'Stiftfarbe'}>
                {isHighlighter ? (
                  <input
                    type="color"
                    value={highlighterColor}
                    onChange={(e) => setHighlighterColor(e.target.value)}
                    className="color-picker"
                  />
                ) : (
                  <input
                    type="color"
                    value={color.substring(0, 7)}
                    onChange={(e) => setColor(e.target.value + (color.substring(7) || 'ff'))}
                    className="color-picker"
                  />
                )}
                <span className="color-label">{isHighlighter ? 'Marker' : 'Stift'}</span>
            </div>
            <div className="color-picker-wrapper" title="Füllfarbe">
                <div className="fill-color-row">
                  <input
                    type="color"
                    value={isTransparent ? lastFillColorRef.current : fillColor.substring(0, 7)}
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    className={`color-picker${isTransparent ? ' color-picker--disabled' : ''}`}
                    disabled={isTransparent}
                  />
                  <button
                    className={`transparent-btn${isTransparent ? ' transparent-btn--active' : ''}`}
                    onClick={toggleTransparent}
                    title={isTransparent ? 'Füllung aktivieren' : 'Transparent'}
                  >⊘</button>
                </div>
                <span className="color-label">Füllung</span>
            </div>
        </div>
      </div>

      <div className="tool-group separator">
        <button className="tool-btn" onClick={prevPage} title="Vorherige Seite"><ChevronLeft size={20} /></button>
        <span className="page-indicator">{activePageIndex + 1} / {document?.pages.length || 1}</span>
        <button className="tool-btn" onClick={nextPage} title="Nächste Seite"><ChevronRight size={20} /></button>
        <button className="tool-btn" onClick={addPage} title="Neue Seite"><Plus size={20} /></button>
      </div>

      <div className="tool-group separator right">
        <button className="tool-btn" onClick={toggleBackground} title="Hintergrund"><Grid3X3 size={20} /></button>
        <button className="tool-btn" onClick={undo} disabled={past.length === 0} title="Undo"><Undo size={20} /></button>
        <button className="tool-btn" onClick={redo} disabled={future.length === 0} title="Redo"><Redo size={20} /></button>
      </div>
    </div>
  );
};
