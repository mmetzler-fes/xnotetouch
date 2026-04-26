import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer } from 'react-konva';
import { useToolStore } from '../../stores/toolStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useUiStore } from '../../stores/uiStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { PageView } from './PageView';
import { SelectionContextMenu } from './SelectionContextMenu';
import { useCanvasSetup } from './hooks/useCanvasSetup';
import { useZoomPan } from './hooks/useZoomPan';
import { useDrawingHandlers } from './hooks/useDrawingHandlers';

const PAGE_SPACING = 40;

export const DocumentCanvas: React.FC = () => {
  const { activeTool, color } = useToolStore();
  const { documents, activeDocumentIndex, activePageIndex, deleteElements, addElementToActivePage } = useDocumentStore();
  const { scale, position, setPosition, pendingInsertImage, setPendingInsertImage } = useUiStore();
  const { elements: clipboardElements, setClipboard } = useClipboardStore();

  const activeDoc = documents[activeDocumentIndex];
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // Track container size for Stage dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    setStageSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  // Vertical page offsets
  const pageOffsets = useMemo(() => {
    if (!activeDoc) return [];
    let y = 20;
    return activeDoc.pages.map(page => {
      const offset = y;
      y += page.height + PAGE_SPACING;
      return offset;
    });
  }, [activeDoc]);

  // Horizontal scrollbar
  const pageWidth = useMemo(() =>
    activeDoc ? Math.max(...activeDoc.pages.map(p => p.width)) : 800,
  [activeDoc]);
  const HSCROLL_H = 12;
  const HSCROLL_MARGIN = 20;
  const contentW = pageWidth * scale;
  const showHScroll = contentW + HSCROLL_MARGIN > stageSize.width + 10;
  const posXMin = stageSize.width - contentW - HSCROLL_MARGIN;
  const posXMax = HSCROLL_MARGIN;
  const scrollRange = posXMax - posXMin;
  const thumbW = showHScroll
    ? Math.max(30, stageSize.width * stageSize.width / (contentW + HSCROLL_MARGIN * 2))
    : stageSize.width;
  const thumbT = scrollRange > 0
    ? Math.max(0, Math.min(1, (posXMax - position.x) / scrollRange))
    : 0;
  const thumbLeft = thumbT * (stageSize.width - thumbW);

  const [hScrollDrag, setHScrollDrag] = useState<{ mouseX: number; posX: number } | null>(null);
  const hScrollRef = useRef({ posXMin, posXMax, scrollRange, stageWidth: stageSize.width, thumbW, posY: position.y });
  hScrollRef.current = { posXMin, posXMax, scrollRange, stageWidth: stageSize.width, thumbW, posY: position.y };

  useEffect(() => {
    if (!hScrollDrag) return;
    const start = hScrollDrag;
    const handleMove = (e: MouseEvent) => {
      const { stageWidth, thumbW: tw, scrollRange: range, posXMin: min, posXMax: max, posY } = hScrollRef.current;
      const deltaT = (e.clientX - start.mouseX) / (stageWidth - tw);
      const newPosX = start.posX - deltaT * range;
      setPosition({ x: Math.max(min, Math.min(max, newPosX)), y: posY });
    };
    const handleUp = () => setHScrollDrag(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hScrollDrag]);

  // Fit-to-width on document switch / resize
  useCanvasSetup(activeDoc, activeDocumentIndex, containerRef);

  // Zoom & pan
  const { handleWheel, isSpacePressed } = useZoomPan();

  // Drawing & editing
  const {
    isDrawing, isMoveMode, setIsMoveMode,
    selectedStrokeIds, setSelectedStrokeIds,
    selectionMenuPos, setSelectionMenuPos,
    editingText, setEditingText,
    contextMenu, setContextMenu,
    lassoPoints,
    screenshotRect,
    laserStrokes, tools,
    drawTick,
    handleMouseDown, handleMouseMove, handleMouseUp, handleTextSubmit,
    moveSelection,
    drawingPageChangeRef,
  } = useDrawingHandlers(stageRef, pageOffsets);

  // Right-click on canvas: show selection/paste menu
  const handleContextMenu = (e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const rawY = (pos.y - stage.y()) / stage.scaleY();
    let pageIdx = activePageIndex;
    for (let i = 0; i < pageOffsets.length; i++) {
      if (rawY >= pageOffsets[i] && rawY <= pageOffsets[i] + (activeDoc?.pages[i]?.height ?? 0)) {
        pageIdx = i;
        break;
      }
    }
    setSelectionMenuPos({ screenX: pos.x, screenY: pos.y, pageIdx });
  };

  // Stable refs so the auto-scroll effect doesn't re-fire when pageOffsets/scale
  // change due to a stroke being added (activeDoc → new pageOffsets reference).
  const pageOffsetsRef = useRef(pageOffsets);
  pageOffsetsRef.current = pageOffsets;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const positionRef = useRef(position);
  positionRef.current = position;

  // Auto-scroll to active page ONLY when activePageIndex changes (tab click).
  // pageOffsets/scale/position are read via refs to avoid re-triggering on
  // every stroke (each stroke creates a new activeDoc → new pageOffsets array).
  useEffect(() => {
    if (drawingPageChangeRef.current) {
      drawingPageChangeRef.current = false;
      return;
    }
    const offsets = pageOffsetsRef.current;
    if (offsets[activePageIndex] !== undefined) {
      setPosition({ x: positionRef.current.x, y: -offsets[activePageIndex] * scaleRef.current + 20 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageIndex]);

  // Insert pending image (triggered by toolbar image button) into the center of the view
  useEffect(() => {
    if (!pendingInsertImage || !stageRef.current) return;
    const { dataUrl, width: imgW, height: imgH } = pendingInsertImage;
    setPendingInsertImage(null);

    const stage = stageRef.current;
    const sc = stage.scaleX();
    const ox = stage.x();
    const oy = stage.y();
    // Center of the visible stage area in canvas coords
    const centerX = (stageSize.width / 2 - ox) / sc;
    const centerY = (stageSize.height / 2 - oy) / sc;

    // Clamp image to fit within the visible stage area (full width/height, not half)
    const maxW = stageSize.width / sc;
    const maxH = stageSize.height / sc;
    const ratio = Math.min(maxW / imgW, maxH / imgH, 1);
    const w = imgW * ratio;
    const h = imgH * ratio;

    // Find which page the center falls on
    const offsets = pageOffsetsRef.current;
    const doc = activeDoc;
    let pageIdx = activePageIndex;
    let pageY = centerY - (offsets[pageIdx] ?? 0);
    for (let i = 0; i < offsets.length; i++) {
      const startY = offsets[i];
      const endY = startY + (doc?.pages[i]?.height ?? 0);
      if (centerY >= startY && centerY <= endY) {
        pageIdx = i;
        pageY = centerY - startY;
        break;
      }
    }

    const newEl = {
      id: `img-${Date.now()}`,
      type: 'image' as const,
      x: centerX - w / 2,
      y: pageY - h / 2,
      width: w,
      height: h,
      dataUrl,
    };
    addElementToActivePage(newEl);
    // Select and immediately enter move/handle mode
    setSelectedStrokeIds(new Set([newEl.id]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInsertImage]);

  // Cursor style
  const getCursorClass = () => {
    if (isMoveMode) return 'cursor-move';
    if (isSpacePressed) return 'cursor-grab';
    switch (activeTool) {
      case 'eraser':      return 'cursor-eraser';
      case 'selection':   return 'cursor-lasso';
      case 'highlighter': return 'cursor-text';
      case 'pen':         return 'cursor-pen';
      case 'laser':
      case 'screenshot':
      case 'shape':       return 'cursor-crosshair';
      default:            return 'cursor-default';
    }
  };

  if (!activeDoc) {
    return <div className="no-document">Kein Dokument geöffnet</div>;
  }

  const effectiveStageH = stageSize.height - (showHScroll ? HSCROLL_H : 0);

  return (
    <div
      ref={containerRef}
      className="document-canvas-container"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <Stage
        width={stageSize.width}
        height={effectiveStageH}
        scaleX={scale} scaleY={scale}
        x={position.x} y={position.y}
        draggable={isSpacePressed}
        onDragEnd={(e) => {
          // Guard: only update position when the Stage itself was dragged,
          // not when a child node's dragend event bubbles up.
          if (e.target === stageRef.current) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onMouseDown={isSpacePressed ? undefined : handleMouseDown}
        onMousemove={isSpacePressed ? undefined : handleMouseMove}
        onMouseup={isSpacePressed ? undefined : handleMouseUp}
        onTouchStart={isSpacePressed ? undefined : handleMouseDown}
        onTouchMove={isSpacePressed ? undefined : handleMouseMove}
        onTouchEnd={isSpacePressed ? undefined : handleMouseUp}
        ref={stageRef}
        className={getCursorClass()}
      >
        <Layer>
          {activeDoc.pages.map((page, pIdx) => (
            <PageView
              key={page.id || pIdx}
              page={page}
              pageIndex={pIdx}
              offsetY={pageOffsets[pIdx]}
              activePageIndex={activePageIndex}
              isDrawing={isDrawing}
              activeTool={activeTool}
              toolInstances={tools as any}
              lassoPoints={lassoPoints}
              screenshotRect={screenshotRect}
              laserStrokes={laserStrokes}
              selectedStrokeIds={selectedStrokeIds}
              drawTick={drawTick}
            />
          ))}
        </Layer>
      </Stage>

      {/* Horizontal scrollbar */}
      {showHScroll && (
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0,
            width: stageSize.width, height: HSCROLL_H,
            background: 'rgba(0,0,0,0.18)', zIndex: 3000,
            userSelect: 'none', cursor: 'default',
          }}
          onMouseDown={(e) => {
            // Click on track → jump thumb to clicked position
            const trackX = e.nativeEvent.offsetX;
            const newThumbLeft = Math.max(0, Math.min(stageSize.width - thumbW, trackX - thumbW / 2));
            const newT = newThumbLeft / (stageSize.width - thumbW);
            const newPosX = posXMax - newT * scrollRange;
            setPosition({ x: Math.max(posXMin, Math.min(posXMax, newPosX)), y: position.y });
          }}
        >
          <div
            style={{
              position: 'absolute', top: 2, height: HSCROLL_H - 4,
              borderRadius: HSCROLL_H / 2, width: thumbW, left: thumbLeft,
              background: 'rgba(200,200,200,0.55)', cursor: 'ew-resize',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setHScrollDrag({ mouseX: e.clientX, posX: position.x });
            }}
          />
        </div>
      )}

      {/* Move mode hint banner */}
      {isMoveMode && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(76,175,80,0.9)', color: '#fff',
          padding: '4px 14px', borderRadius: 6, fontSize: 13,
          pointerEvents: 'none', zIndex: 2500,
        }}>
          Verschieben — Klicken und Ziehen, loslassen zum Ablegen
        </div>
      )}

      {/* Selection context menu */}
      {selectionMenuPos && (
        <SelectionContextMenu
          screenX={selectionMenuPos.screenX}
          screenY={selectionMenuPos.screenY}
          pageIdx={selectionMenuPos.pageIdx}
          selectedIds={selectedStrokeIds}
          stageRef={stageRef}
          scale={scale}
          position={position}
          pageOffsets={pageOffsets}
          moveSelection={moveSelection}
          onStartMove={() => {
            setSelectionMenuPos(null);   // hide menu but keep selection
            setTimeout(() => setIsMoveMode(true), 50);
          }}
          onClose={() => { setSelectionMenuPos(null); setSelectedStrokeIds(new Set()); }}
        />
      )}

      {/* Text editing overlay */}
      {editingText && (
        <textarea
          autoFocus
          value={editingText.text}
          onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
          onBlur={handleTextSubmit}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleTextSubmit(); }}
          style={{
            position: 'absolute',
            top: (pageOffsets[editingText.pageIdx] + editingText.y) * scale + position.y,
            left: editingText.x * scale + position.x,
            fontSize: (12 * scale) + 'px',
            color,
            background: 'rgba(255,255,255,0.8)',
            border: '1px dashed #4CAF50',
            outline: 'none',
            padding: '2px',
            zIndex: 2000,
            minWidth: '100px',
            fontFamily: 'Sans-serif',
            resize: 'both',
          }}
        />
      )}

      {/* Context menu overlay */}
      {contextMenu.show && (
        <div style={{
          position: 'absolute',
          top: contextMenu.y, left: contextMenu.x,
          background: '#2d2d2d', border: '1px solid #444',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          padding: '4px', display: 'flex', flexDirection: 'column', zIndex: 1000,
        }}>
          <button
            className="menu-btn danger"
            onClick={() => {
              deleteElements(Array.from(selectedStrokeIds));
              setContextMenu({ ...contextMenu, show: false });
              setSelectedStrokeIds(new Set());
            }}
          >
            Löschen
          </button>
          <button
            className="menu-btn"
            onClick={() => {
              const page = activeDoc.pages[contextMenu.pageIdx];
              const activeLayer = page.layers[page.layers.length - 1];
              const selected = activeLayer.elements.filter(el => selectedStrokeIds.has(el.id));
              setClipboard(selected);
              setContextMenu({ ...contextMenu, show: false });
              setSelectedStrokeIds(new Set());
            }}
          >
            Als Vektor kopieren
          </button>
        </div>
      )}
    </div>
  );
};
