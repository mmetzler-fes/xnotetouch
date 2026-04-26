import React from 'react';
import { useDocumentStore, createEmptyDocument } from '../../stores/documentStore';
import { parseXopp } from '../../lib/xopp/parser';
import { serializeXopp } from '../../lib/xopp/serializer';
import { exportToPdf } from '../../lib/pdf/exporter';
import { loadPdf } from '../../lib/pdf/renderer';
import { FolderOpen, Save, FileDown, FileUp, Eye, EyeOff } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';
import './AppMenu.css';

// Check if we're running in Tauri (v2 uses __TAURI_INTERNALS__)
const isTauri = () =>
  typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' ||
  typeof (window as any).__TAURI__ !== 'undefined';

export const AppMenu: React.FC = () => {
  const { addDocument, documents, activeDocumentIndex } = useDocumentStore();
  const { isSidebarVisible, setSidebarVisible } = useUiStore();
  const document = documents[activeDocumentIndex];

  const handleOpen = async () => {
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readFile } = await import('@tauri-apps/plugin-fs');
        
        const selected = await open({
          multiple: false,
          title: 'Xournal++ Datei öffnen (.xopp)'
        });
        if (typeof selected === 'string') {
          if (!selected.endsWith('.xopp')) {
            alert('Bitte wählen Sie eine .xopp Datei (Xournal++ Format).');
            return;
          }
          const fileData = await readFile(selected);
          const parsedDoc = parseXopp(fileData, selected);
          addDocument(parsedDoc);
        }
      } catch (e) {
        console.error("Tauri: Failed to open file", e);
        alert('Fehler beim Öffnen der Datei: ' + (e as Error).message);
      }
    } else {
      // Browser: File Input
      const input = window.document.createElement('input');
      input.type = 'file';
      input.accept = '.xopp,application/x-xopp';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const reader = new FileReader();
          reader.onload = async (ev: any) => {
            try {
              const parsedDoc = parseXopp(ev.target.result, file.name);
              addDocument(parsedDoc);
            } catch (err) {
              console.error('Failed to parse file:', err);
              alert('Fehler beim Öffnen der Datei: ' + (err as Error).message);
            }
          };
          reader.readAsArrayBuffer(file);
        } catch (err) {
          console.error('Failed to read file:', err);
        }
      };
      input.click();
    }
  };

  const handleSaveAs = async () => {
    if (!document) return;
    
    if (isTauri()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        
        let selected = await save({
          defaultPath: document.filePath || document.title + '.xopp',
          filters: [{ name: 'Xournal++', extensions: ['xopp'] }]
        });
        if (typeof selected === 'string') {
          if (!selected.endsWith('.xopp')) selected += '.xopp';
          const data = serializeXopp(document);
          await writeFile(selected, data);
          
          const fullFileName = selected.split(/[/\\]/).pop() || '';
          const lastDotIndex = fullFileName.lastIndexOf('.');
          const newTitle = lastDotIndex !== -1 ? fullFileName.substring(0, lastDotIndex) : fullFileName;
          
          useDocumentStore.getState().updateDocumentMetadata(activeDocumentIndex, { 
            filePath: selected,
            title: newTitle
          });
        }
      } catch (e) {
        console.error("Failed to save file", e);
      }
    } else {
      // Browser: Download
      try {
        const data = serializeXopp(document);
        const blob = new Blob([data], { type: 'application/xml' });
        const a = window.document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (document.title || 'document') + '.xopp';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } catch (err) {
        console.error('Failed to save file:', err);
        alert('Fehler beim Speichern: ' + (err as Error).message);
      }
    }
  };

  const handlePdfImport = async () => {
    if (isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readFile } = await import('@tauri-apps/plugin-fs');
        
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
        console.error("Failed to import pdf", e);
        alert('Fehler beim PDF Import: ' + (e as Error).message);
      }
    } else {
      // Browser: File Input
      const input = window.document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf';
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
          const reader = new FileReader();
          reader.onload = async (ev: any) => {
            try {
              const arrayBuffer = ev.target.result as ArrayBuffer;
              const pdf = await loadPdf(arrayBuffer);
              
              // Im Browser: PDF-Daten als Base64 Data-URL speichern
              const uint8Array = new Uint8Array(arrayBuffer);
              const base64 = btoa(String.fromCharCode(...uint8Array));
              const dataUrl = `data:application/pdf;base64,${base64}`;
              
              useDocumentStore.getState().addPdfPages(dataUrl, pdf.numPages);
            } catch (err) {
              console.error('Failed to load PDF:', err);
              alert('Fehler beim Laden des PDFs: ' + (err as Error).message);
            }
          };
          reader.readAsArrayBuffer(file);
        } catch (err) {
          console.error('Failed to read file:', err);
        }
      };
      input.click();
    }
  };

  return (
    <div className="app-menu">
      <button className="menu-item" onClick={() => setSidebarVisible(!isSidebarVisible)} title="Vorschau umschalten">
        {isSidebarVisible ? <EyeOff size={16} /> : <Eye size={16} />} Vorschau
      </button>
      <button className="menu-item" onClick={handleOpen} title="Öffnen">
        <FolderOpen size={16} /> Öffnen
      </button>
      <button className="menu-item" onClick={handleSaveAs} title="Speichern unter">
        <Save size={16} /> Speichern unter
      </button>
      <button className="menu-item" onClick={handlePdfImport} title="PDF Import">
        <FileUp size={16} /> PDF Import
      </button>
      <button className="menu-item" onClick={async () => {
        if (isTauri()) {
          await exportToPdf();
        } else {
          // Browser: PDF-Export als Download
          try {
            const { documents, activeDocumentIndex } = useDocumentStore.getState();
            const currentDoc = documents[activeDocumentIndex];
            if (!currentDoc || currentDoc.pages.length === 0) {
              alert('Kein Dokument zum Exportieren.');
              return;
            }
            const jsPDF = (await import('jspdf')).default;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            
            for (let i = 0; i < currentDoc.pages.length; i++) {
              const page = currentDoc.pages[i];
              const canvas = window.document.createElement('canvas');
              canvas.width = page.width;
              canvas.height = page.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, page.width, page.height);
                // Hier könnte man noch Layer rendern, für Demo nur weiß
              }
              const dataUrl = canvas.toDataURL('image/png');
              if (i > 0) pdf.addPage();
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            }
            
            const blob = pdf.output('blob');
            const a = window.document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (currentDoc.title || 'document') + '.pdf';
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          } catch (err) {
            console.error('PDF export failed:', err);
            alert('Fehler beim PDF-Export: ' + (err as Error).message);
          }
        }
      }} title="PDF Export">
        <FileDown size={16} /> PDF Export
      </button>
    </div>
  );
};
