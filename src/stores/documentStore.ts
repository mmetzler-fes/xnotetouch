import { create } from 'zustand';
import { XoppDocument, Stroke, Page, LayerElement, TextElement, Layer, SolidBackground, PdfBackground } from '../types/xopp';

interface DocumentState {
  documents: XoppDocument[];
  activeDocumentIndex: number;
  activePageIndex: number;
  activeLayerId: string | null;
  past: XoppDocument[][];
  future: XoppDocument[][];
  
  // Actions
  undo: () => void;
  redo: () => void;
  addDocument: (doc: XoppDocument) => void;
  closeDocument: (index: number) => void;
  setActiveDocument: (index: number) => void;
  setActivePage: (index: number) => void;
  setActiveLayer: (layerId: string) => void;
  addStrokeToActivePage: (stroke: Stroke) => void;
  addElementToActivePage: (element: LayerElement) => void;
  deleteElements: (ids: string[]) => void;
  updateLastStroke: (points: { x: number; y: number; pressure?: number }[]) => void;
  setPageBackground: (style: 'plain' | 'graph') => void;
  setPageBackgroundPdf: (filename: string, pageno: number) => void;
  addPdfPages: (filename: string, pageCount: number) => void;
  addPage: () => void;
  nextPage: () => void;
  prevPage: () => void;
  deletePage: (index: number) => void;
  movePage: (fromIndex: number, direction: 'up' | 'down') => void;
  
  // Layer Actions
  toggleLayerVisibility: (layerId: string) => void;
  addLayerToActivePage: () => void;
  deleteLayerFromActivePage: (layerId: string) => void;
  updateDocumentMetadata: (index: number, metadata: Partial<XoppDocument>) => void;
}

const MAX_HISTORY = 50;

export const createEmptyDocument = (title: string = "Unbenannt"): XoppDocument => {
  const layerId = `layer-${Date.now()}`;
  return {
    version: '0.4.8',
    creator: 'XNoteTouch',
    title,
    pages: [{
      id: `page-${Date.now()}`,
      width: 595.275591,
      height: 841.889764,
      background: { type: 'solid', color: '#ffffffff', style: 'plain' },
      layers: [{ id: layerId, type: 'drawing', elements: [], visible: true } as Layer]
    }]
  };
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [createEmptyDocument()],
  activeDocumentIndex: 0,
  activePageIndex: 0,
  activeLayerId: null, // Will be set on first document load
  past: [],
  future: [],

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      documents: previous,
      past: newPast,
      future: [state.documents, ...state.future]
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      documents: next,
      past: [...state.past, state.documents],
      future: newFuture
    };
  }),
  
  addDocument: (doc) => {
    const state = get();
    const newDocs = [...state.documents, doc];
    const firstLayerId = doc.pages[0]?.layers[0]?.id || null;
    set({ 
      documents: newDocs, 
      activeDocumentIndex: newDocs.length - 1,
      activePageIndex: 0,
      activeLayerId: firstLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    });
  },
  
  closeDocument: (index) => set((state) => {
    const newDocs = state.documents.filter((_, i) => i !== index);
    if (newDocs.length === 0) {
      newDocs.push(createEmptyDocument());
    }
    const newIndex = state.activeDocumentIndex >= newDocs.length 
      ? newDocs.length - 1 
      : state.activeDocumentIndex;
      
    const firstLayerId = newDocs[newIndex]?.pages[0]?.layers[0]?.id || null;
      
    return { 
      documents: newDocs, 
      activeDocumentIndex: newIndex, 
      activePageIndex: 0,
      activeLayerId: firstLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  updateDocumentMetadata: (index, metadata) => set((state) => {
    const newDocs = [...state.documents];
    if (newDocs[index]) {
      newDocs[index] = { ...newDocs[index], ...metadata };
    }
    return { documents: newDocs };
  }),

  setActiveDocument: (index) => set((state) => {
    const doc = state.documents[index];
    const firstLayerId = doc?.pages[0]?.layers[0]?.id || null;
    return { activeDocumentIndex: index, activePageIndex: 0, activeLayerId: firstLayerId };
  }),
  
  setActivePage: (index) => set((state) => {
    const doc = state.documents[state.activeDocumentIndex];
    const page = doc?.pages[index];
    const firstLayerId = page?.layers[page.layers.length - 1]?.id || null;
    return { activePageIndex: index, activeLayerId: firstLayerId };
  }),

  setActiveLayer: (layerId) => set({ activeLayerId: layerId }),
  
  addStrokeToActivePage: (stroke) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          
          // Find active layer or use last one
          let targetLayerId = state.activeLayerId;
          if (!targetLayerId && page.layers.length > 0) {
            targetLayerId = page.layers[page.layers.length - 1].id;
          }

          return {
            ...page,
            layers: page.layers.map((layer) => {
              if (layer.id !== targetLayerId) return layer;
              return {
                ...layer,
                elements: [...layer.elements, stroke]
              };
            })
          };
        })
      };
    });
    return { 
      documents: newDocs,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  addElementToActivePage: (element) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          
          let targetLayerId = state.activeLayerId;
          if (!targetLayerId && page.layers.length > 0) {
            targetLayerId = page.layers[page.layers.length - 1].id;
          }

          return {
            ...page,
            layers: page.layers.map((layer) => {
              if (layer.id !== targetLayerId) return layer;
              return {
                ...layer,
                elements: [...layer.elements, element]
              };
            })
          };
        })
      };
    });
    return { 
      documents: newDocs,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  deleteElements: (ids) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          return {
            ...page,
            layers: page.layers.map(layer => ({
              ...layer,
              elements: layer.elements.filter(el => !ids.includes(el.id))
            }))
          };
        })
      };
    });
    return { 
      documents: newDocs,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),
  
  updateLastStroke: (points) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;

          let targetLayerId = state.activeLayerId;
          if (!targetLayerId && page.layers.length > 0) {
            targetLayerId = page.layers[page.layers.length - 1].id;
          }

          return {
            ...page,
            layers: page.layers.map((layer) => {
              if (layer.id !== targetLayerId) return layer;
              const newElements = [...layer.elements];
              const lastEl = newElements[newElements.length - 1];
              if (lastEl && 'points' in lastEl) {
                newElements[newElements.length - 1] = { ...lastEl, points };
              }
              return { ...layer, elements: newElements };
            })
          };
        })
      };
    });
    return { documents: newDocs };
  }),
  
  setPageBackground: (style) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          return {
            ...page,
            background: { type: 'solid', color: '#ffffffff', style } as SolidBackground
          };
        })
      };
    });
    return { 
      documents: newDocs,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  setPageBackgroundPdf: (filename, pageno) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          return {
            ...page,
            background: { type: 'pdf', domain: 'absolute', filename, pageno } as PdfBackground
          };
        })
      };
    });
    return { 
      documents: newDocs,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  addPdfPages: (filename, pageCount) => set((state) => {
    const activeDoc = state.documents[state.activeDocumentIndex];
    if (!activeDoc) return state;

    const firstPage = activeDoc.pages[0];
    const isFirstPageEmpty = activeDoc.pages.length === 1 && 
                             firstPage.layers[0].elements.length === 0 && 
                             firstPage.background?.type === 'solid';

    const newPages: Page[] = [];
    for (let i = 1; i <= pageCount; i++) {
      newPages.push({
        id: `pdf-page-${Date.now()}-${i}`,
        width: 595.275591,
        height: 841.889764,
        background: { type: 'pdf', domain: 'absolute', filename, pageno: i },
        layers: [{ id: `layer-${Date.now()}-${i}`, type: 'drawing', elements: [], visible: true } as Layer]
      });
    }

    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: isFirstPageEmpty ? newPages : [...doc.pages, ...newPages]
      };
    });

    return { 
      documents: newDocs, 
      activePageIndex: 0,
      activeLayerId: newPages[0].layers[0].id,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  addPage: () => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      const newPage: Page = {
        id: `page-${Date.now()}`,
        width: 595.275591,
        height: 841.889764,
        background: { type: 'solid', color: '#ffffffff', style: 'plain' },
        layers: [{ id: `layer-${Date.now()}`, type: 'drawing', elements: [], visible: true } as Layer]
      };
      return {
        ...doc,
        pages: [...doc.pages, newPage]
      };
    });
    
    const updatedDoc = newDocs[state.activeDocumentIndex];
    const newPageIndex = updatedDoc ? updatedDoc.pages.length - 1 : 0;
    const newLayerId = updatedDoc?.pages[newPageIndex].layers[0].id || null;

    return { 
      documents: newDocs, 
      activePageIndex: newPageIndex,
      activeLayerId: newLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  nextPage: () => set((state) => {
    const doc = state.documents[state.activeDocumentIndex];
    if (doc && state.activePageIndex < doc.pages.length - 1) {
      const nextPageIndex = state.activePageIndex + 1;
      const firstLayerId = doc.pages[nextPageIndex].layers[doc.pages[nextPageIndex].layers.length - 1].id;
      return { activePageIndex: nextPageIndex, activeLayerId: firstLayerId };
    }
    return state;
  }),

  prevPage: () => set((state) => {
    if (state.activePageIndex > 0) {
      const prevPageIndex = state.activePageIndex - 1;
      const doc = state.documents[state.activeDocumentIndex];
      const firstLayerId = doc.pages[prevPageIndex].layers[doc.pages[prevPageIndex].layers.length - 1].id;
      return { activePageIndex: prevPageIndex, activeLayerId: firstLayerId };
    }
    return state;
  }),
  
  deletePage: (index) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      if (doc.pages.length <= 1) return doc;
      return {
        ...doc,
        pages: doc.pages.filter((_, i) => i !== index)
      };
    });
    
    let newPageIndex = state.activePageIndex;
    if (index <= state.activePageIndex && state.activePageIndex > 0) {
      newPageIndex--;
    }
    
    const updatedDoc = newDocs[state.activeDocumentIndex];
    const newLayerId = updatedDoc?.pages[newPageIndex]?.layers[updatedDoc.pages[newPageIndex].layers.length - 1].id || null;

    return { 
      documents: newDocs, 
      activePageIndex: newPageIndex,
      activeLayerId: newLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  movePage: (fromIndex, direction) => set((state) => {
    const doc = state.documents[state.activeDocumentIndex];
    if (!doc) return state;
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= doc.pages.length) return state;
    const newPages = [...doc.pages];
    [newPages[fromIndex], newPages[toIndex]] = [newPages[toIndex], newPages[fromIndex]];
    const newDocs = state.documents.map((d, i) =>
      i === state.activeDocumentIndex ? { ...d, pages: newPages } : d
    );
    const newActivePageIndex = state.activePageIndex === fromIndex ? toIndex : state.activePageIndex;
    return {
      documents: newDocs,
      activePageIndex: newActivePageIndex,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: [],
    };
  }),

  toggleLayerVisibility: (layerId) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          return {
            ...page,
            layers: page.layers.map(layer => {
              if (layer.id !== layerId) return layer;
              return { ...layer, visible: layer.visible === false ? true : false };
            })
          };
        })
      };
    });
    return { documents: newDocs };
  }),

  addLayerToActivePage: () => set((state) => {
    const newLayerId = `layer-${Date.now()}`;
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          return {
            ...page,
            layers: [...page.layers, { id: newLayerId, type: 'drawing', elements: [], visible: true } as Layer]
          };
        })
      };
    });
    return { 
      documents: newDocs,
      activeLayerId: newLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  }),

  deleteLayerFromActivePage: (layerId) => set((state) => {
    const newDocs = state.documents.map((doc, dIdx) => {
      if (dIdx !== state.activeDocumentIndex) return doc;
      return {
        ...doc,
        pages: doc.pages.map((page, pIdx) => {
          if (pIdx !== state.activePageIndex) return page;
          // Don't delete the last layer
          if (page.layers.length <= 1) return page;
          return {
            ...page,
            layers: page.layers.filter(layer => layer.id !== layerId)
          };
        })
      };
    });
    
    // Reset active layer if it was deleted
    let nextActiveLayerId = state.activeLayerId;
    if (state.activeLayerId === layerId) {
      const activePage = newDocs[state.activeDocumentIndex].pages[state.activePageIndex];
      nextActiveLayerId = activePage.layers[activePage.layers.length - 1].id;
    }

    return { 
      documents: newDocs,
      activeLayerId: nextActiveLayerId,
      past: [...state.past, state.documents].slice(-MAX_HISTORY),
      future: []
    };
  })
}));
