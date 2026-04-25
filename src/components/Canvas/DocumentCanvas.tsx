import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Line, Rect, Group, Image as KonvaImage, Text as KonvaText } from 'react-konva';
import { useToolStore } from '../../stores/toolStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { Stroke, ImageElement, LayerElement, Page } from '../../types/xopp';
import { PdfLayer } from './PdfLayer';
import { GridLayer } from './GridLayer';
import { PressureLine } from './PressureLine';
import { isPointInPolygon, getPointsBoundingBox, Point, isPointNearPolyline } from '../../lib/math/geometry';

const PAGE_SPACING = 40;

export const PastedImage: React.FC<{ element: ImageElement }> = ({ element }) => {
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = element.dataUrl;
    img.onload = () => setImgObj(img);
  }, [element.dataUrl]);
  if (!imgObj) return null;
  return <KonvaImage x={element.x} y={element.y} width={element.width} height={element.height} image={imgObj} />;
};

export const DocumentCanvas: React.FC = () => {
  const { activeTool, color, strokeWidth } = useToolStore();
  const { 
    documents, 
    activeDocumentIndex, 
    activePageIndex, 
    setActivePage, 
    addStrokeToActivePage, 
    addElementToActivePage,
    deleteElements
  } = useDocumentStore();
  const { scale, position, setScale, setPosition } = useUiStore();
  const { elements: clipboardElements, setClipboard } = useClipboardStore();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const [editingText, setEditingText] = useState<{id?: string, x: number, y: number, text: string, pageIdx: number} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, show: boolean, pageIdx: number}>({ x: 0, y: 0, show: false, pageIdx: 0 });
  const stageRef = useRef<any>(null);

  const activeDoc = documents[activeDocumentIndex];
  
  // Calculate vertical positions of pages
  const pageOffsets = useMemo(() => {
    if (!activeDoc) return [];
    let currentY = 20; // Top margin
    return activeDoc.pages.map(page => {
      const y = currentY;
      currentY += page.height + PAGE_SPACING;
      return y;
    });
  }, [activeDoc]);

  // Initial Fit-to-Width / Fit-to-Page logic
  useEffect(() => {
    if (activeDoc && activeDoc.pages.length > 0 && stageRef.current) {
      const firstPage = activeDoc.pages[0];
      const stageWidth = window.innerWidth - 470;
      const stageHeight = window.innerHeight - 86;
      
      // Calculate scale to fit page width with some margin
      const padding = 40;
      const scaleX = (stageWidth - padding) / firstPage.width;
      const scaleY = (stageHeight - padding) / firstPage.height;
      const newScale = Math.min(scaleX, scaleY, 1.0); // Don't upscale past 1.0 by default
      
      setScale(newScale);
      
      // Center the page horizontally
      const x = (stageWidth - firstPage.width * newScale) / 2;
      setPosition({ x, y: 20 });
    }
  }, [activeDocumentIndex]); // Only run when document changes

  if (!activeDoc) return <div className="no-document">Kein Dokument geöffnet</div>;

  const handleTextSubmit = () => {
    if (editingText && editingText.text.trim()) {
      if (activePageIndex !== editingText.pageIdx) setActivePage(editingText.pageIdx);
      addElementToActivePage({
        id: editingText.id || `text-${Date.now()}`,
        type: 'text',
        x: editingText.x,
        y: editingText.y,
        text: editingText.text,
        font: 'Sans',
        size: 12,
        color: color
      });
    }
    setEditingText(null);
  };

  const getPageInfoAt = (y: number) => {
    for (let i = 0; i < pageOffsets.length; i++) {
      const startY = pageOffsets[i];
      const endY = startY + activeDoc.pages[i].height;
      if (y >= startY && y <= endY) {
        return { index: i, pageY: y - startY };
      }
    }
    return null;
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const x = (pos.x - stage.x()) / stage.scaleX();
    const rawY = (pos.y - stage.y()) / stage.scaleY();
    
    const pageInfo = getPageInfoAt(rawY);
    if (!pageInfo) return;
    
    const { index: pageIdx, pageY: y } = pageInfo;
    if (activePageIndex !== pageIdx) setActivePage(pageIdx);
    
    if (activeTool === 'text') {
      setEditingText({ x, y, text: '', pageIdx });
      return;
    }
    
    if (e.evt.button === 1) return; // Middle click for panning handled by stage draggable
    if (e.evt.button !== 0 && !e.evt.touches) return;
    
    setIsDrawing(true);
    setContextMenu({ ...contextMenu, show: false });
    
    if (activeTool === 'lasso') {
      setLassoPoints([{ x, y }]);
      setSelectedStrokeIds(new Set());
      return;
    }
    
    if (activeTool === 'eraser') {
      const page = activeDoc.pages[pageIdx];
      const activeLayer = page.layers[page.layers.length - 1]; // Target top layer or active layer
      const toDelete: string[] = [];
      activeLayer.elements.forEach(el => {
        if ('points' in el && isPointNearPolyline({ x, y }, el.points, 10)) toDelete.push(el.id);
      });
      if (toDelete.length > 0) deleteElements(toDelete);
      return;
    }
    
    const pressure = e.evt.pressure || 0.5;
    const newStroke: Stroke = {
      id: Date.now().toString(),
      tool: activeTool as any,
      color: color,
      width: strokeWidth,
      capStyle: 'round',
      points: [{ x, y, pressure }]
    };
    setActiveStroke(newStroke);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const x = (pos.x - stage.x()) / stage.scaleX();
    const rawY = (pos.y - stage.y()) / stage.scaleY();
    
    // For drawing, we want to stay within the page where we started
    const startY = pageOffsets[activePageIndex];
    const y = rawY - startY;
    
    if (activeTool === 'lasso') {
      setLassoPoints([...lassoPoints, { x, y }]);
      return;
    }
    
    if (activeTool === 'eraser') {
      const page = activeDoc.pages[activePageIndex];
      const activeLayer = page.layers[page.layers.length - 1];
      const toDelete: string[] = [];
      activeLayer.elements.forEach(el => {
        if ('points' in el && isPointNearPolyline({ x, y }, el.points, 10)) toDelete.push(el.id);
      });
      if (toDelete.length > 0) deleteElements(toDelete);
      return;
    }
    
    if (activeStroke) {
      const pressure = e.evt.pressure || 0.5;
      setActiveStroke({
        ...activeStroke,
        points: [...activeStroke.points, { x, y, pressure }]
      });
    }
  };

  const handleMouseUp = (e: any) => {
    setIsDrawing(false);
    
    if (activeStroke) {
      addStrokeToActivePage(activeStroke);
      setActiveStroke(null);
    }
    
    if (activeTool === 'lasso' && lassoPoints.length > 2) {
      const page = activeDoc.pages[activePageIndex];
      const activeLayer = page.layers[page.layers.length - 1];
      const selectedIds = new Set<string>();
      activeLayer.elements.forEach(el => {
        if ('points' in el) {
          const isInside = el.points.some(p => isPointInPolygon(p, lassoPoints));
          if (isInside) selectedIds.add(el.id);
        }
      });
      setSelectedStrokeIds(selectedIds);
      if (selectedIds.size > 0) {
        const stage = stageRef.current;
        const pos = stage.getPointerPosition();
        if (pos) setContextMenu({ x: pos.x, y: pos.y, show: true, pageIdx: activePageIndex });
      }
      setLassoPoints([]);
    }
  };

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (clipboardElements.length > 0) {
          const stage = stageRef.current;
          const pointerPos = stage?.getPointerPosition();
          
          let offsetX = 20;
          let offsetY = 20;

          if (pointerPos) {
            const stageX = (pointerPos.x - stage.x()) / stage.scaleX();
            const stageY = (pointerPos.y - stage.y()) / stage.scaleY();
            
            const pageInfo = getPageInfoAt(stageY);
            if (pageInfo) {
              const { index: pageIdx, pageY: y } = pageInfo;
              if (activePageIndex !== pageIdx) setActivePage(pageIdx);
              
              // Center logic
              let allPoints: Point[] = [];
              clipboardElements.forEach(el => {
                if ('points' in el) allPoints = allPoints.concat(el.points);
                else if ('width' in el && 'height' in el) allPoints.push({ x: (el as any).x, y: (el as any).y }, { x: (el as any).x + (el as any).width, y: (el as any).y + (el as any).height });
                else allPoints.push({ x: (el as any).x, y: (el as any).y });
              });
              const box = getPointsBoundingBox(allPoints);
              const centerX = (box.minX + box.maxX) / 2;
              const centerY = (box.minY + box.maxY) / 2;
              
              offsetX = stageX - centerX;
              offsetY = y - centerY;
            }
          }

          clipboardElements.forEach((el, idx) => {
            const newEl = JSON.parse(JSON.stringify(el));
            newEl.id = `${el.id}-paste-${Date.now()}-${idx}`;
            if ('points' in newEl) {
              newEl.points = newEl.points.map((p: Point) => ({ ...p, x: p.x + offsetX, y: p.y + offsetY }));
            } else { 
              newEl.x += offsetX; 
              newEl.y += offsetY; 
            }
            addElementToActivePage(newEl);
          });
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') setIsSpacePressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [clipboardElements, activePageIndex, addElementToActivePage]);

  const handleWheel = (e: any) => {
    if (e.evt.ctrlKey) {
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      if (newScale < 0.1 || newScale > 10) return;
      setScale(newScale);
      setPosition({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
    } else {
      // Smooth scrolling
      setPosition({ x: position.x, y: position.y - e.evt.deltaY });
    }
  };

  const isPanning = isSpacePressed;
  const getCursorClass = () => {
    if (isPanning) return 'cursor-grab';
    switch (activeTool) {
      case 'eraser': return 'cursor-eraser';
      case 'lasso': return 'cursor-lasso';
      case 'highlighter': return 'cursor-text';
      case 'pen': return 'cursor-pen';
      default: return 'cursor-default';
    }
  };

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const img = new Image();
                img.onload = () => {
                  const stage = stageRef.current;
                  const pos = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
                  const x = (pos.x - stage.x()) / stage.scaleX();
                  const rawY = (pos.y - stage.y()) / stage.scaleY();
                  const pageInfo = getPageInfoAt(rawY);
                  if (pageInfo) {
                    const newElement: ImageElement = { id: `img-${Date.now()}`, type: 'image', x, y: pageInfo.pageY, width: img.width, height: img.height, dataUrl };
                    if (activePageIndex !== pageInfo.index) setActivePage(pageInfo.index);
                    addElementToActivePage(newElement);
                  }
                };
                img.src = dataUrl;
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activePageIndex, addElementToActivePage]);

  return (
    <div className="document-canvas-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Stage
        width={window.innerWidth - 470} height={window.innerHeight - 86}
        scaleX={scale} scaleY={scale} x={position.x} y={position.y}
        draggable={isPanning} onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
        onWheel={handleWheel} onMouseDown={isPanning ? undefined : handleMouseDown}
        onMousemove={isPanning ? undefined : handleMouseMove} onMouseup={isPanning ? undefined : handleMouseUp}
        onTouchStart={isPanning ? undefined : handleMouseDown} onTouchMove={isPanning ? undefined : handleMouseMove}
        onTouchEnd={isPanning ? undefined : handleMouseUp} ref={stageRef} className={getCursorClass()}
      >
        <Layer>
          {activeDoc.pages.map((page, pIdx) => (
            <Group key={page.id || pIdx} y={pageOffsets[pIdx]}>
              {/* Page Background & Shadow */}
              <Rect x={0} y={0} width={page.width} height={page.height} fill="#ffffff" shadowColor="black" shadowBlur={10} shadowOpacity={0.3} shadowOffset={{ x: 2, y: 2 }} />
              
              {/* Specialized Backgrounds */}
              {page.background?.type === 'solid' && (
                <Group>
                  <Rect width={page.width} height={page.height} fill={page.background.color} />
                  <GridLayer width={page.width} height={page.height} style={page.background.style} />
                </Group>
              )}
              {page.background?.type === 'pdf' && (
                <PdfLayer filename={page.background.filename} pageno={page.background.pageno} width={page.width} height={page.height} />
              )}
              
              {/* Drawing Layers */}
              {page.layers.map((layer, lIndex) => {
                if (layer.visible === false) return null;
                return (
                  <Group key={layer.id || `layer-${lIndex}`}>
                    {layer.elements.map((el) => {
                      if ('points' in el) {
                        return <PressureLine key={el.id} stroke={el} isSelected={selectedStrokeIds.has(el.id)} />;
                      } else if (el.type === 'image') {
                        return <PastedImage key={el.id} element={el} />;
                      } else if (el.type === 'text') {
                        return <KonvaText key={el.id} x={el.x} y={el.y} text={el.text} fontSize={el.size} fill={el.color} fontFamily={el.font} />;
                      }
                      return null;
                    })}
                  </Group>
                );
              })}
              
              {/* Active Stroke (if drawing on this page) */}
              {isDrawing && activePageIndex === pIdx && activeStroke && <PressureLine stroke={activeStroke} isSelected={false} />}
              
              {/* Lasso (if active on this page) */}
              {lassoPoints.length > 0 && activePageIndex === pIdx && <Line points={lassoPoints.flatMap(p => [p.x, p.y])} stroke="#4CAF50" strokeWidth={1.5} dash={[5, 5]} closed={true} />}
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* Text Editor Overlay */}
      {editingText && (
        <textarea
          autoFocus value={editingText.text} onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
          onBlur={handleTextSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleTextSubmit(); }}
          style={{
            position: 'absolute', top: (pageOffsets[editingText.pageIdx] + editingText.y) * scale + position.y, left: editingText.x * scale + position.x,
            fontSize: (12 * scale) + 'px', color: color, background: 'rgba(255,255,255,0.8)', border: '1px dashed #4CAF50',
            outline: 'none', padding: '2px', zIndex: 2000, minWidth: '100px', fontFamily: 'Sans-serif', resize: 'both'
          }}
        />
      )}

      {/* Context Menu Overlay */}
      {contextMenu.show && (
        <div style={{
          position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: '#2d2d2d', border: '1px solid #444',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '4px', display: 'flex', flexDirection: 'column', zIndex: 1000
        }}>
          <button className="menu-btn danger" onClick={() => { deleteElements(Array.from(selectedStrokeIds)); setContextMenu({ ...contextMenu, show: false }); setSelectedStrokeIds(new Set()); }}>Löschen</button>
          <button className="menu-btn" onClick={() => { 
            const page = activeDoc.pages[contextMenu.pageIdx];
            const activeLayer = page.layers[page.layers.length - 1]; 
            const selectedElements = activeLayer.elements.filter(el => selectedStrokeIds.has(el.id)); 
            setClipboard(selectedElements); setContextMenu({ ...contextMenu, show: false }); setSelectedStrokeIds(new Set()); 
          }}>Als Vektor kopieren</button>
        </div>
      )}
    </div>
  );
};
