import React from 'react';
import { useDocumentStore, createEmptyDocument } from '../../stores/documentStore';
import { X, Plus } from 'lucide-react';
import './DocumentTabs.css';

export const DocumentTabs: React.FC = () => {
  const { documents, activeDocumentIndex, setActiveDocument, closeDocument, addDocument } = useDocumentStore();

  return (
    <div className="document-tabs-container">
      {documents.map((doc, idx) => (
        <div 
          key={idx} 
          className={`document-tab ${idx === activeDocumentIndex ? 'active' : ''}`}
          onClick={() => setActiveDocument(idx)}
        >
          <span className="tab-title">{doc.title}</span>
          <button 
            className="tab-close-btn" 
            onClick={(e) => {
              e.stopPropagation();
              closeDocument(idx);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button 
        className="add-tab-btn" 
        onClick={() => addDocument(createEmptyDocument(`Unbenannt ${documents.length + 1}`))}
        title="Neues Dokument"
      >
        <Plus size={18} />
      </button>
    </div>
  );
};
