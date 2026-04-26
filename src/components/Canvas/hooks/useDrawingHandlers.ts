import { useState, useEffect, useMemo, useRef } from 'react';
import { useToolStore } from '../../../stores/toolStore';
import { useDocumentStore } from '../../../stores/documentStore';
import { useClipboardStore } from '../../../stores/clipboardStore';
import { ImageElement } from '../../../types/xopp';
import { Point, getPointsBoundingBox } from '../../../lib/math/geometry';
import { PenTool } from '../../../lib/tools/PenTool';
import { EraserTool } from '../../../lib/tools/EraserTool';
import { HighlighterTool } from '../../../lib/tools/HighlighterTool';
import { ShapeTool } from '../../../lib/tools/ShapeTool';
import { SelectionTool } from '../../../lib/tools/SelectionTool';
import { ImageTool } from '../../../lib/tools/ImageTool';
import { LaserPointerTool } from '../../../lib/tools/LaserPointerTool';
import { ScreenshotTool, ScreenshotRect } from '../../../lib/tools/ScreenshotTool';

export type EditingText = { id?: string; x: number; y: number; text: string; pageIdx: number } | null;
export type ContextMenuState = { x: number; y: number; show: boolean; pageIdx: number };
export type SelectionMenuPos = { screenX: number; screenY: number; pageIdx: number } | null;

/**
 * Encapsulates all drawing/editing input logic:
 * mouse-down/move/up, keyboard paste (Ctrl+V), clipboard image paste,
 * text editing overlay, context menu, and laser-pointer animation.
 */
export function useDrawingHandlers(
  stageRef: React.RefObject<any>,
  pageOffsets: number[]
) {
  const { activeTool, color, fillColor, strokeWidth } = useToolStore();
  const {
    documents, activeDocumentIndex, activePageIndex,
    setActivePage, addStrokeToActivePage, addElementToActivePage, deleteElements,
  } = useDocumentStore();
  const { elements: clipboardElements, setClipboard } = useClipboardStore();

  const activeDoc = documents[activeDocumentIndex];

  // Use refs for values read inside useEffect listeners to avoid stale closures
  const pageOffsetsRef = useRef(pageOffsets);
  pageOffsetsRef.current = pageOffsets;
  const activeDocRef = useRef(activeDoc);
  activeDocRef.current = activeDoc;
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  // Tracks the page being actively drawn on — set in mouseDown, used in move/up
  const drawingPageIndexRef = useRef(activePageIndex);
  // Set to true when setActivePage is called from drawing (not a tab click),
  // so DocumentCanvas can suppress the auto-scroll for that change.
  const drawingPageChangeRef = useRef(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const moveCursorRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<Set<string>>(new Set());
  const selectedStrokeIdsRef = useRef(selectedStrokeIds);
  selectedStrokeIdsRef.current = selectedStrokeIds;
  const [editingText, setEditingText] = useState<EditingText>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, show: false, pageIdx: 0 });
  const [selectionMenuPos, setSelectionMenuPos] = useState<SelectionMenuPos>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [laserStrokes, setLaserStrokes] = useState<any[]>([]);
  const [screenshotRect, setScreenshotRect] = useState<ScreenshotRect | null>(null);
  const [pendingCapture, setPendingCapture] = useState<ScreenshotRect | null>(null);
  // Incremented on every mousemove while drawing → forces PageView to re-read getActiveStroke()
  const [drawTick, setDrawTick] = useState(0);

  // --- Deferred screenshot capture (runs after Konva has redrawn without the dashed-rect overlay) ---
  useEffect(() => {
    if (!pendingCapture) return;
    const rect = pendingCapture;
    setPendingCapture(null); // prevent re-run
    // One rAF ensures Konva has flushed its canvas redraw before we call toDataURL
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const sc = stage.scaleX();
      const ox = stage.x();
      const oy = stage.y();
      const pageOffY = pageOffsetsRef.current[drawingPageIndexRef.current] ?? 0;
      const pixX = rect.x * sc + ox;
      const pixY = (rect.y + pageOffY) * sc + oy;
      const pixW = rect.width * sc;
      const pixH = rect.height * sc;
      const dataUrl = stage.toDataURL({ x: pixX, y: pixY, width: pixW, height: pixH, pixelRatio: 1 });
      const imgEl: ImageElement = {
        id: `screenshot-${Date.now()}`,
        type: 'image',
        x: rect.x, y: rect.y,
        width: rect.width, height: rect.height,
        dataUrl,
      };
      useClipboardStore.getState().setClipboard([imgEl]);
    });
  }, [pendingCapture]);

  // Register SelectionTool callback once tools are created (see below)
  // Tool instances are stable for the lifetime of this hook
  const tools = useMemo(() => ({
    pen: new PenTool(),
    highlighter: new HighlighterTool(),
    eraser: new EraserTool(),
    shape: new ShapeTool(),
    selection: new SelectionTool(),
    image: new ImageTool(),
    laser: new LaserPointerTool(),
    screenshot: new ScreenshotTool(),
    text: null,
    lasso: null,
  }), []);

  // Wire up SelectionTool → update selectedStrokeIds + show selection menu
  useEffect(() => {
    (tools.selection as SelectionTool).setOnSelection((ids) => {
      setSelectedStrokeIds(new Set(ids));
      if (ids.length > 0) {
        const stage = stageRef.current;
        const pos = stage?.getPointerPosition();
        const { activePageIndex: api } = useDocumentStore.getState();
        setSelectionMenuPos(pos
          ? { screenX: pos.x, screenY: pos.y, pageIdx: api }
          : null
        );
      } else {
        setSelectionMenuPos(null);
      }
    });
  }, [tools.selection]);

  // Laser pointer fade animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (tools.laser) {
        const current = (tools.laser as LaserPointerTool).getStrokes();
        setLaserStrokes(prev => (current.length > 0 || prev.length > 0) ? [...current] : prev);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [tools.laser]);

  // ---------- helpers ----------

  const getPageInfoAt = (canvasY: number) => {
    const offsets = pageOffsetsRef.current;
    const doc = activeDocRef.current;
    for (let i = 0; i < offsets.length; i++) {
      const startY = offsets[i];
      const endY = startY + doc.pages[i].height;
      if (canvasY >= startY && canvasY <= endY) {
        return { index: i, pageY: canvasY - startY };
      }
    }
    return null;
  };

  const buildToolContext = (pageIdxOverride?: number) => {
    const { activeTool: at, color: c, fillColor: fc, strokeWidth: sw, highlighterColor: hc, highlighterStrokeWidth: hsw } = useToolStore.getState();
    const { documents: docs, activeDocumentIndex: adi, activePageIndex: api,
      setActivePage: sap, addStrokeToActivePage: addStroke,
      addElementToActivePage: addEl, deleteElements: delEls } = useDocumentStore.getState();
    // For the highlighter tool, use its dedicated color and stroke width
    const effectiveColor = at === 'highlighter' ? hc : c;
    const effectiveStrokeWidth = at === 'highlighter' ? hsw : sw;
    return {
      color: effectiveColor, fillColor: fc, strokeWidth: effectiveStrokeWidth,
      activePageIndex: pageIdxOverride ?? api,
      activeDoc: docs[adi],
      addStroke, addElement: addEl, deleteElements: delEls, setActivePage: sap,
    };
  };

  const handleDragActiveRef = useRef(false);

  // ---------- Konva event handlers ----------

  const handleMouseDown = (e: any) => {
    // Skip if a shape-resize handle was clicked
    if (e.target?.name?.() === 'shape-handle') {
      handleDragActiveRef.current = true;
      return;
    }
    handleDragActiveRef.current = false;

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const x = (pos.x - stage.x()) / stage.scaleX();
    const rawY = (pos.y - stage.y()) / stage.scaleY();

    // --- Move mode: start drag from current cursor ---
    if (isMoveMode) {
      if (e.evt.button === 1) return;
      const y = rawY - (pageOffsetsRef.current[activePageIndexRef.current] ?? 0);
      moveCursorRef.current = { x, y };
      return;
    }

    const pageInfo = getPageInfoAt(rawY);
    if (!pageInfo) return;
    const { index: pageIdx, pageY: y } = pageInfo;

    // Set the drawing page immediately so the correct page is active while drawing.
    // Mark drawingPageChangeRef so DocumentCanvas suppresses the auto-scroll.
    drawingPageIndexRef.current = pageIdx;
    const { activePageIndex: api, setActivePage: sap } = useDocumentStore.getState();
    if (api !== pageIdx) {
      drawingPageChangeRef.current = true;
      sap(pageIdx);
    }

    if (activeTool === 'text') {
      setEditingText({ x, y, text: '', pageIdx });
      return;
    }
    if (e.evt.button === 1) return; // Middle-click: panning only
    if (e.evt.button !== 0 && !e.evt.touches) return;

    // Close selection menu on new draw
    setSelectionMenuPos(null);
    setIsDrawing(true);
    setContextMenu(prev => ({ ...prev, show: false }));
    if (activeTool === 'selection') setLassoPoints([{ x, y }]);
    if (activeTool === 'screenshot') setScreenshotRect({ x, y, width: 0, height: 0 });

    const tool = (tools as any)[activeTool];
    tool?.onMouseDown(x, y, e.evt.pressure || 0.5, buildToolContext(pageIdx));
  };

  const handleMouseMove = (e: any) => {
    // --- Move mode: translate selected elements ---
    if (isMoveMode && moveCursorRef.current !== null) {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const x = (pos.x - stage.x()) / stage.scaleX();
      const rawY = (pos.y - stage.y()) / stage.scaleY();
      const y = rawY - (pageOffsetsRef.current[activePageIndexRef.current] ?? 0);
      const dx = x - moveCursorRef.current.x;
      const dy = y - moveCursorRef.current.y;
      moveCursorRef.current = { x, y };
      moveSelectionImmediate(dx, dy);
      return;
    }

    if (!isDrawing && activeTool !== 'laser') return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = (pos.x - stage.x()) / stage.scaleX();
    const rawY = (pos.y - stage.y()) / stage.scaleY();
    const y = rawY - (pageOffsetsRef.current[drawingPageIndexRef.current] ?? 0);

    if (activeTool === 'selection' && isDrawing) {
      setLassoPoints(prev => [...prev, { x, y }]);
    }
    if (activeTool === 'screenshot' && isDrawing) {
      const screenshotTool = (tools as any)['screenshot'] as ScreenshotTool;
      screenshotTool.onMouseMove(x, y, e.evt.pressure || 0.5, buildToolContext(drawingPageIndexRef.current));
      const rect = screenshotTool.getActiveRect();
      if (rect) setScreenshotRect(rect);
      return;
    }

    const tool = (tools as any)[activeTool];
    tool?.onMouseMove(x, y, e.evt.pressure || 0.5, buildToolContext(drawingPageIndexRef.current));
    // Force re-render so PageView reads the updated activeStroke for live preview
    if (isDrawing) setDrawTick(t => t + 1);
  };

  const handleMouseUp = (e: any) => {
    // Skip if a handle drag just ended
    if (handleDragActiveRef.current) {
      handleDragActiveRef.current = false;
      return;
    }

    // --- Move mode: commit, clear selection and exit ---
    if (isMoveMode) {
      moveCursorRef.current = null;
      setIsMoveMode(false);
      setSelectionMenuPos(null);
      setSelectedStrokeIds(new Set());
      const { documents: docs } = useDocumentStore.getState();
      useDocumentStore.setState({ documents: [...docs] });
      return;
    }

    setIsDrawing(false);
    setLassoPoints([]);

    // --- Screenshot capture ---
    if (activeTool === 'screenshot') {
      const rect = screenshotRect;
      setScreenshotRect(null); // hide overlay → Konva will redraw on next rAF
      if (rect && rect.width > 4 && rect.height > 4) {
        setPendingCapture(rect); // useEffect + rAF will capture after the redraw
      }
      (tools as any)['screenshot'].onMouseUp(0, 0, 0, buildToolContext(drawingPageIndexRef.current));
      return;
    }
    const tool = (tools as any)[activeTool];
    if (!tool) return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const drawPageIdx = drawingPageIndexRef.current;
    if (pos) {
      const x = (pos.x - stage.x()) / stage.scaleX();
      const rawY = (pos.y - stage.y()) / stage.scaleY();
      const y = rawY - (pageOffsetsRef.current[drawPageIdx] ?? 0);
      tool.onMouseUp(x, y, e.evt.pressure || 0.5, buildToolContext(drawPageIdx));
    } else {
      tool.onMouseUp(0, 0, 0.5, buildToolContext(drawPageIdx));
    }
  };

  const handleTextSubmit = () => {
    if (editingText?.text.trim()) {
      const { activePageIndex: api, setActivePage: sap, addElementToActivePage: addEl } = useDocumentStore.getState();
      const { color: c } = useToolStore.getState();
      if (api !== editingText.pageIdx) sap(editingText.pageIdx);
      addEl({
        id: editingText.id || `text-${Date.now()}`,
        type: 'text',
        x: editingText.x,
        y: editingText.y,
        text: editingText.text,
        font: 'Sans',
        size: 12,
        color: c,
      });
    }
    setEditingText(null);
  };

  // ---------- Keyboard paste (Ctrl+V) ----------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'v')) return;
      const { elements: cbEls } = useClipboardStore.getState();
      if (!cbEls.length) return;

      const stage = stageRef.current;
      const pointerPos = stage?.getPointerPosition();
      let offsetX = 20, offsetY = 20;

      if (pointerPos) {
        const stageX = (pointerPos.x - stage.x()) / stage.scaleX();
        const stageY = (pointerPos.y - stage.y()) / stage.scaleY();
        const pageInfo = getPageInfoAt(stageY);
        if (pageInfo) {
          const { index: pageIdx, pageY: y } = pageInfo;
          const { activePageIndex: api, setActivePage: sap } = useDocumentStore.getState();
          if (api !== pageIdx) sap(pageIdx);

          let allPoints: Point[] = [];
          cbEls.forEach(el => {
            if ('points' in el) allPoints = allPoints.concat((el as any).points);
            else { allPoints.push({ x: (el as any).x, y: (el as any).y }); }
          });
          const box = getPointsBoundingBox(allPoints);
          offsetX = stageX - (box.minX + box.maxX) / 2;
          offsetY = y - (box.minY + box.maxY) / 2;
        }
      }

      cbEls.forEach((el, idx) => {
        const newEl = JSON.parse(JSON.stringify(el));
        newEl.id = `${el.id}-paste-${Date.now()}-${idx}`;
        if ('points' in newEl) {
          newEl.points = newEl.points.map((p: Point) => ({ ...p, x: p.x + offsetX, y: p.y + offsetY }));
        } else {
          newEl.x += offsetX;
          newEl.y += offsetY;
        }
        useDocumentStore.getState().addElementToActivePage(newEl);
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // stable: reads from store getState() inside handler

  // ---------- Clipboard image paste ----------

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) return;
          const img = new Image();
          img.onload = () => {
            const stage = stageRef.current;
            if (!stage) return;
            const pos = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
            const x = (pos.x - stage.x()) / stage.scaleX();
            const rawY = (pos.y - stage.y()) / stage.scaleY();
            const pageInfo = getPageInfoAt(rawY);
            if (!pageInfo) return;
            const newEl: ImageElement = {
              id: `img-${Date.now()}`, type: 'image',
              x, y: pageInfo.pageY, width: img.width, height: img.height, dataUrl,
            };
            const { activePageIndex: api, setActivePage: sap, addElementToActivePage: addEl } = useDocumentStore.getState();
            if (api !== pageInfo.index) sap(pageInfo.index);
            addEl(newEl);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(blob);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []); // stable: reads store via getState()

  // Move selected elements by delta in-place (no history snapshot – called on every mousemove)
  const moveSelectionImmediate = (dx: number, dy: number) => {
    const { documents: docs, activeDocumentIndex: adi, activePageIndex: api } = useDocumentStore.getState();
    const ids = Array.from(selectedStrokeIdsRef.current);
    if (!ids.length) return;
    // Mutate in-place for performance during drag, then trigger re-render
    const page = docs[adi].pages[api];
    page.layers.forEach(layer => {
      layer.elements.forEach(el => {
        if (!ids.includes(el.id)) return;
        if ('points' in el) {
          el.points = el.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        } else if (el.type === 'rect' || el.type === 'image' || el.type === 'text') {
          (el as any).x += dx;
          (el as any).y += dy;
        } else if (el.type === 'line') {
          el.x1 += dx; el.y1 += dy;
          el.x2 += dx; el.y2 += dy;
        } else if (el.type === 'circle') {
          (el as any).cx += dx; (el as any).cy += dy;
        } else if (el.type === 'triangle') {
          (el as any).x1 += dx; (el as any).y1 += dy;
          (el as any).x2 += dx; (el as any).y2 += dy;
          (el as any).x3 += dx; (el as any).y3 += dy;
        }
      });
    });
    useDocumentStore.setState({ documents: [...docs] });
  };

  // Move selected elements by delta (page-coordinates)
  const moveSelection = (dx: number, dy: number) => {
    const { documents: docs, activeDocumentIndex: adi, activePageIndex: api } = useDocumentStore.getState();
    const ids = Array.from(selectedStrokeIds);
    if (!ids.length) return;
    const page = docs[adi].pages[api];
    page.layers.forEach(layer => {
      layer.elements.forEach(el => {
        if (!ids.includes(el.id)) return;
        if ('points' in el) {
          el.points = el.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        } else if (el.type === 'rect' || el.type === 'image' || el.type === 'text') {
          (el as any).x += dx;
          (el as any).y += dy;
        } else if (el.type === 'line') {
          el.x1 += dx; el.y1 += dy;
          el.x2 += dx; el.y2 += dy;
        } else if (el.type === 'circle') {
          (el as any).cx += dx; (el as any).cy += dy;
        } else if (el.type === 'triangle') {
          (el as any).x1 += dx; (el as any).y1 += dy;
          (el as any).x2 += dx; (el as any).y2 += dy;
          (el as any).x3 += dx; (el as any).y3 += dy;
        }
      });
    });
    // Trigger a re-render by touching the documents array
    useDocumentStore.setState({ documents: [...docs] });
  };

  return {
    isDrawing,
    isMoveMode, setIsMoveMode,
    selectedStrokeIds, setSelectedStrokeIds,
    selectionMenuPos, setSelectionMenuPos,
    editingText, setEditingText,
    contextMenu, setContextMenu,
    lassoPoints,
    screenshotRect,
    laserStrokes,
    tools,
    drawTick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTextSubmit,
    getPageInfoAt,
    moveSelection,
    drawingPageChangeRef,
  };
}
