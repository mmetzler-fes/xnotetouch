import React from 'react';
import { useDocumentStore } from '../../stores/documentStore';
import { Eye, EyeOff, Layers, Plus, Trash2 } from 'lucide-react';
import './LayerPanel.css';

export const LayerPanel: React.FC = () => {
  const { 
    documents, 
    activeDocumentIndex, 
    activePageIndex, 
    activeLayerId,
    setActiveLayer,
    toggleLayerVisibility, 
    addLayerToActivePage, 
    deleteLayerFromActivePage 
  } = useDocumentStore();
  
  const document = documents[activeDocumentIndex];
  const activePage = document?.pages[activePageIndex];

  if (!activePage) return null;

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <div className="header-title">
          <Layers size={16} />
          <span>Ebenen</span>
        </div>
        <button 
          className="add-layer-btn" 
          title="Neue Ebene"
          onClick={addLayerToActivePage}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="layers-list">
        {/* Layer 1 is the PDF Background (Virtual) */}
        {activePage.background?.type === 'pdf' && (
          <div className="layer-item virtual">
            <div className="layer-visibility">
              <Eye size={16} />
            </div>
            <div className="layer-name">PDF Hintergrund</div>
          </div>
        )}

        {[...activePage.layers].reverse().map((layer, idx) => (
          <div 
            key={layer.id} 
            className={`layer-item ${activeLayerId === layer.id ? 'active' : ''}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <div 
              className="layer-visibility" 
              onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
              style={{ cursor: 'pointer' }}
            >
              {layer.visible !== false ? <Eye size={16} /> : <EyeOff size={16} color="#888" />}
            </div>
            <div className="layer-name">Zeichnung {activePage.layers.length - idx}</div>
            <button 
              className="delete-layer-btn"
              onClick={(e) => { e.stopPropagation(); deleteLayerFromActivePage(layer.id); }}
              disabled={activePage.layers.length <= 1}
              title="Ebene löschen"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
