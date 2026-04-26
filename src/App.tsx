import React from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { DocumentCanvas } from './components/Canvas/DocumentCanvas';
import { DocumentTabs } from './components/DocumentTabs/DocumentTabs';
import { LayerPanel } from './components/LayerPanel/LayerPanel';
import { useDocumentStore } from './stores/documentStore';
import { useUiStore } from './stores/uiStore';

import { readFile, watch } from '@tauri-apps/plugin-fs';
import { ask } from '@tauri-apps/plugin-dialog';
import { parseXopp } from './lib/xopp/parser';
import { isInternalSaving, saveDocument } from './lib/fs/persistence';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppMenu } from './components/AppMenu/AppMenu';

function App() {
  const { documents, activeDocumentIndex, undo, redo, addDocument } = useDocumentStore();
  const document = documents[activeDocumentIndex];

  // Update native window title (nur in Tauri)
  React.useEffect(() => {
    // Nur ausführen, wenn Tauri-API verfügbar ist
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || typeof (window as any).__TAURI__ !== 'undefined';
    if (isTauri && typeof getCurrentWindow === 'function') {
      getCurrentWindow().setTitle('XNoteTouch');
    }
  }, []);

  // Auto-Save Effect for ALL documents (nur in Tauri)
  React.useEffect(() => {
    // Nur in Tauri aktivieren
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return;
    
    const timer = setInterval(() => {
      documents.forEach(doc => {
        if (doc.filePath && doc.filePath.endsWith('.xopp')) {
          saveDocument(doc, doc.filePath);
        }
      });
    }, 30000); 

    return () => clearInterval(timer);
  }, [documents]);

  // File Watcher Effect (nur in Tauri)
  React.useEffect(() => {
    // Nur in Tauri aktivieren
    const isTauri = typeof (window as any).__TAURI_INTERNALS__ !== 'undefined' || typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return;
    
    let unwatch: (() => void) | null = null;

    const startWatching = async () => {
      if (!document?.filePath) return;
      
      try {
        unwatch = await watch(document.filePath, (event) => {
          // Check for modification
          if (!isInternalSaving && (event.type === 'any' || (typeof event.type === 'object' && 'modify' in event.type))) {
            handleExternalChange();
          }
        });
      } catch (e) {
        console.error("Failed to start file watcher:", e);
      }
    };

    const handleExternalChange = async () => {
      if (!document?.filePath) return;
      const shouldReload = await ask(
        `Die Datei "${document.title}" wurde extern geändert. Möchtest du sie neu laden? (Nicht gespeicherte Änderungen gehen verloren)`,
        { title: 'Datei geändert', kind: 'warning' }
      );
      
      if (shouldReload) {
        const fileData = await readFile(document.filePath);
        const parsedDoc = parseXopp(fileData, document.filePath);
        addDocument(parsedDoc);
      }
    };

    startWatching();
    return () => { if (unwatch) unwatch(); };
  }, [document?.filePath]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const { isSidebarVisible } = useUiStore();

  return (
    <div className="app-container">
      <header className="titlebar">
        <h1>XNoteTouch</h1>
        <AppMenu />
      </header>
      <DocumentTabs />
      <main className="main-content">
        {isSidebarVisible && (
          <aside className="sidebar">
            <Sidebar />
          </aside>
        )}
        <section className="canvas-area">
          <div className="toolbar">
            <Toolbar />
          </div>
          <div className="canvas-wrapper">
            <DocumentCanvas />
          </div>
        </section>
        <aside className="right-panel">
          <LayerPanel />
        </aside>
      </main>
    </div>
  );
}

export default App;
