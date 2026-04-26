import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { documents, activeDocumentIndex, activePageIndex, setActivePage, addPage, deletePage, movePage } = useDocumentStore();
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
            <div className="thumb-actions">
              <button
                className="thumb-action-btn"
                onClick={(e) => { e.stopPropagation(); movePage(idx, 'up'); }}
                disabled={idx === 0}
                title="Seite nach oben"
              >
                <ChevronUp size={12} />
              </button>
              <button
                className="thumb-action-btn"
                onClick={(e) => { e.stopPropagation(); movePage(idx, 'down'); }}
                disabled={idx === document.pages.length - 1}
                title="Seite nach unten"
              >
                <ChevronDown size={12} />
              </button>
              {document.pages.length > 1 && (
                <button 
                  className="thumb-action-btn thumb-delete-btn" 
                  onClick={(e) => { e.stopPropagation(); deletePage(idx); }}
                  title="Seite löschen"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
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
