import React from 'react';
import { Plus } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { documents, activeDocumentIndex, activePageIndex, setActivePage, addPage } = useDocumentStore();
  const document = documents[activeDocumentIndex];

  if (!document) return null;

  return (
    <div className="sidebar-container">
      <div className="thumbnails-list">
        {document.pages.map((page, idx) => (
          <div 
            key={page.id || idx} 
            className={`thumbnail ${idx === activePageIndex ? 'active' : ''}`}
            onClick={() => setActivePage(idx)}
          >
            <div className="thumb-page">{idx + 1}</div>
          </div>
        ))}
      </div>
      <button className="add-page-btn" onClick={addPage}>
        <Plus size={20} />
        <span>Neue Seite</span>
      </button>
    </div>
  );
};
