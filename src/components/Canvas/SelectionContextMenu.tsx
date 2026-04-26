import React, { useEffect, useRef } from 'react';
import { LayerElement } from '../../types/xopp';
import { useDocumentStore } from '../../stores/documentStore';
import { useClipboardStore } from '../../stores/clipboardStore';
import { Point, getPointsBoundingBox } from '../../lib/math/geometry';
import './SelectionContextMenu.css';

interface Props {
  screenX: number;
  screenY: number;
  pageIdx: number;
  selectedIds: Set<string>;
  /** stage position + scale for paste-at-cursor calculation */
  stageRef: React.RefObject<any>;
  scale: number;
  position: { x: number; y: number };
  pageOffsets: number[];
  moveSelection: (dx: number, dy: number) => void;
  onStartMove: () => void;
  onClose: () => void;
}

export const SelectionContextMenu: React.FC<Props> = ({
  screenX, screenY, pageIdx,
  selectedIds, stageRef, scale, position, pageOffsets,
  moveSelection, onStartMove, onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { documents, activeDocumentIndex, deleteElements, addElementToActivePage, setActivePage } = useDocumentStore();
  const { elements: cbElements, setClipboard } = useClipboardStore();

  const activeDoc = documents[activeDocumentIndex];
  const hasSelection = selectedIds.size > 0;
  const hasClipboard = cbElements.length > 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid closing immediately on the mousedown that opened the menu
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // --- helpers ---

  const getSelectedElements = (): LayerElement[] => {
    const page = activeDoc?.pages[pageIdx];
    if (!page) return [];
    const result: LayerElement[] = [];
    page.layers.forEach(layer => {
      layer.elements.forEach(el => {
        if (selectedIds.has(el.id)) result.push(el);
      });
    });
    return result;
  };

  const copyToClipboard = () => {
    const els = getSelectedElements();
    // Deep-clone so clipboard is independent
    setClipboard(JSON.parse(JSON.stringify(els)));
  };

  const pasteFromClipboard = () => {
    if (!cbElements.length) return;
    const stage = stageRef.current;
    const pos = stage?.getPointerPosition() ?? { x: screenX, y: screenY };
    const stageX = (pos.x - position.x) / scale;
    const stageY = (pos.y - position.y) / scale;
    const targetPageY = stageY - (pageOffsets[pageIdx] ?? 0);

    // Center clipboard content at cursor
    let allPoints: Point[] = [];
    cbElements.forEach(el => {
      if ('points' in el) allPoints = allPoints.concat((el as any).points);
      else allPoints.push({ x: (el as any).x ?? 0, y: (el as any).y ?? 0 });
    });
    const box = getPointsBoundingBox(allPoints.length ? allPoints : [{ x: 0, y: 0 }]);
    const offsetX = stageX - (box.minX + box.maxX) / 2;
    const offsetY = targetPageY - (box.minY + box.maxY) / 2;

    setActivePage(pageIdx);
    cbElements.forEach((el, idx) => {
      const newEl = JSON.parse(JSON.stringify(el));
      newEl.id = `${el.id}-paste-${Date.now()}-${idx}`;
      if ('points' in newEl) {
        newEl.points = newEl.points.map((p: Point) => ({ ...p, x: p.x + offsetX, y: p.y + offsetY }));
      } else if (newEl.type === 'line') {
        newEl.x1 += offsetX; newEl.y1 += offsetY;
        newEl.x2 += offsetX; newEl.y2 += offsetY;
      } else {
        newEl.x += offsetX;
        newEl.y += offsetY;
      }
      addElementToActivePage(newEl);
    });
    onClose();
  };

  const handleCopy = () => { copyToClipboard(); onClose(); };

  const handleCut = () => {
    copyToClipboard();
    deleteElements(Array.from(selectedIds));
    onClose();
  };

  const handleDelete = () => { deleteElements(Array.from(selectedIds)); onClose(); };

  const handleMove = () => {
    // Do NOT call onClose here – that would clear the selection.
    // onStartMove will hide the menu while preserving selectedStrokeIds.
    setTimeout(() => onStartMove(), 50);
  };

  return (
    <div
      ref={menuRef}
      className="selection-context-menu"
      style={{ top: screenY, left: screenX }}
    >
      {hasSelection && (
        <>
          <button className="ctx-item" onClick={handleMove}>Verschieben</button>
          <button className="ctx-item" onClick={handleCopy}>Kopieren</button>
          <button className="ctx-item" onClick={handleCut}>Ausschneiden</button>
          <button className="ctx-item ctx-item--danger" onClick={handleDelete}>Löschen</button>
          <div className="ctx-separator" />
        </>
      )}
      {hasClipboard && (
        <button className="ctx-item" onClick={pasteFromClipboard}>Einfügen</button>
      )}
      {!hasSelection && !hasClipboard && (
        <span className="ctx-empty">Keine Auswahl</span>
      )}
    </div>
  );
};
