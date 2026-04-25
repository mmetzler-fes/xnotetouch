import React from 'react';
import { useToolStore } from '../../stores/toolStore';
import { useDocumentStore, createEmptyDocument } from '../../stores/documentStore';
import { Page, Layer } from '../../types/xopp';
import { Pen, Highlighter, Eraser, Undo, Redo, Download, FolderOpen, Save, Grid3X3, MousePointer2, FileText, Plus, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readDir, BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { parseXopp } from '../../lib/xopp/parser';
import { serializeXopp } from '../../lib/xopp/serializer';
import { exportToPdf } from '../../lib/pdf/exporter';
import { loadPdf } from '../../lib/pdf/renderer';
import { invoke } from '@tauri-apps/api/core';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const { activeTool, color, strokeWidth, setTool, setColor, setStrokeWidth } = useToolStore();
  const { 
    documents, 
    activeDocumentIndex, 
    activePageIndex, 
    addDocument, 
    setPageBackground, 
    addPage, 
    nextPage, 
    prevPage,
    undo,
    redo,
    past,
    future
  } = useDocumentStore();
  
  React.useEffect(() => {
    console.log("Tauri internals check:", (window as any).__TAURI_INTERNALS__);
    console.log("Invoke function check:", invoke);
  }, []);

  const document = documents[activeDocumentIndex];

  const handleOpen = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Xournal++', extensions: ['xopp'] },
          { name: 'PDF', extensions: ['pdf'] }
        ]
      });
      if (typeof selected === 'string') {
        if (selected.endsWith('.pdf')) {
          // Open PDF as new document
          const fileData = await readFile(selected);
          const { pdfDoc, numPages, width, height } = await loadPdf(fileData.buffer as ArrayBuffer);
          
          const newDoc = createEmptyDocument(selected.split(/[/\\]/).pop() || 'PDF Document');
          newDoc.pages = []; // Clear default page
          
          for (let i = 1; i <= numPages; i++) {
            newDoc.pages.push({
              id: `pdf-page-${Date.now()}-${i}`,
              width: width,
              height: height,
              background: { type: 'pdf', domain: 'absolute', filename: selected, pageno: i },
              layers: [{ id: `layer-${Date.now()}-${i}`, type: 'drawing', elements: [] } as Layer]
            });
          }
          addDocument(newDoc);
        } else {
          // Open .xopp
          const fileData = await readFile(selected);
          const parsedDoc = parseXopp(fileData, selected);
          addDocument(parsedDoc);
        }
      }
    } catch (e) {
      console.error("Failed to open file", e);
    }
  };

  const handleSave = async () => {
    try {
      let selected = await save({
        filters: [{ name: 'Xournal++', extensions: ['xopp'] }]
      });
      if (typeof selected === 'string') {
        if (!selected.endsWith('.xopp')) {
          selected += '.xopp';
        }
        const data = serializeXopp(document);
        await writeFile(selected, data);
      }
    } catch (e) {
      console.error("Failed to save file", e);
    }
  };

  const toggleBackground = () => {
    const activePage = document?.pages[activePageIndex];
    if (activePage?.background?.type === 'solid') {
      const newStyle = activePage.background.style === 'plain' ? 'graph' : 'plain';
      setPageBackground(newStyle);
    } else {
      setPageBackground('graph');
    }
  };

  const handlePdfInsert = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (typeof selected === 'string') {
        const fileData = await readFile(selected);
        const pdf = await loadPdf(fileData.buffer as ArrayBuffer);
        useDocumentStore.getState().addPdfPages(selected, pdf.numPages);
      }
    } catch (e) {
      console.error("Failed to open pdf", e);
    }
  };

  return (
    <div className="toolbar-container">
      <div className="tool-group">
        <button className="tool-btn" onClick={handleOpen} title="Öffnen"><FolderOpen size={20} /></button>
        <button className="tool-btn" onClick={handleSave} title="Speichern"><Save size={20} /></button>
      </div>

      <div className="tool-group separator">
        <button className="tool-btn" onClick={prevPage} title="Vorherige Seite"><ChevronLeft size={20} /></button>
        <span className="page-indicator">{activePageIndex + 1} / {document?.pages.length || 1}</span>
        <button className="tool-btn" onClick={nextPage} title="Nächste Seite"><ChevronRight size={20} /></button>
        <button className="tool-btn" onClick={addPage} title="Neue Seite"><Plus size={20} /></button>
      </div>

      <div className="tool-group separator">
        <button
          className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
          onClick={() => setTool('pen')}
          title="Stift"
        >
          <Pen size={20} />
        </button>
        <button
          className={`tool-btn ${activeTool === 'highlighter' ? 'active' : ''}`}
          onClick={() => setTool('highlighter')}
          title="Textmarker"
        >
          <Highlighter size={20} />
        </button>
        <button
          className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
          onClick={() => setTool('eraser')}
          title="Radiergummi"
        >
          <Eraser size={20} />
        </button>
        <button
          className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`}
          onClick={() => setTool('text')}
          title="Text"
        >
          <Type size={20} />
        </button>
        <button
          className={`tool-btn ${activeTool === 'lasso' ? 'active' : ''}`}
          onClick={() => setTool('lasso')}
          title="Lasso Auswahl"
        >
          <MousePointer2 size={20} />
        </button>
      </div>

      <div className="tool-group separator">
        <input
          type="color"
          value={color.substring(0, 7)} // remove alpha for input
          onChange={(e) => setColor(e.target.value + 'ff')}
          className="color-picker"
          title="Farbe"
        />
        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="width-picker"
          title="Strichstärke"
        >
          <option value={1}>Fein (1)</option>
          <option value={1.41}>Standard (1.41)</option>
          <option value={2}>Mittel (2)</option>
          <option value={4}>Breit (4)</option>
        </select>
      </div>

      <div className="tool-group separator right">
        <button className="tool-btn" onClick={toggleBackground} title="Hintergrund umschalten (Weiß/Kariert)"><Grid3X3 size={20} /></button>
        <button className="tool-btn" onClick={handlePdfInsert} title="PDF Importieren"><FileText size={20} /></button>
        <button className="tool-btn" onClick={undo} disabled={past.length === 0} title="Undo"><Undo size={20} /></button>
        <button className="tool-btn" onClick={redo} disabled={future.length === 0} title="Redo"><Redo size={20} /></button>
        <button className="tool-btn primary" onClick={exportToPdf} title="Als PDF Exportieren"><Download size={20} /></button>
      </div>
    </div>
  );
};
