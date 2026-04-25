import React from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { DocumentCanvas } from './components/Canvas/DocumentCanvas';
import { DocumentTabs } from './components/DocumentTabs/DocumentTabs';
import { LayerPanel } from './components/LayerPanel/LayerPanel';
import { useDocumentStore } from './stores/documentStore';

function App() {
  const { documents, activeDocumentIndex, undo, redo } = useDocumentStore();
  const document = documents[activeDocumentIndex];

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

  return (
    <div className="app-container">
      <header className="titlebar">
        <h1>XNoteTouch</h1>
      </header>
      <DocumentTabs />
      <main className="main-content">
        <aside className="sidebar">
          <Sidebar />
        </aside>
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
