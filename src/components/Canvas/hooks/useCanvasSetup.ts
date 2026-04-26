import { useEffect, useRef } from 'react';
import { XoppDocument } from '../../../types/xopp';
import { useUiStore } from '../../../stores/uiStore';

const LEFT_MARGIN = 20;
const TOP_MARGIN = 20;

/**
 * Fits the first page of the active document to the full container width
 * whenever the active document changes or the container is resized.
 */
export function useCanvasSetup(
  activeDoc: XoppDocument | null | undefined,
  activeDocumentIndex: number,
  containerRef: React.RefObject<HTMLDivElement>
) {
  const { setScale, setPosition } = useUiStore();

  // Keep a stable ref so fitToWidth always reads the latest activeDoc
  // without re-running the ResizeObserver effect on every stroke.
  const activeDocRef = useRef(activeDoc);
  activeDocRef.current = activeDoc;

  const fitToWidth = () => {
    if (!activeDocRef.current?.pages?.length || !containerRef.current) return;
    const { clientWidth } = containerRef.current;
    const firstPage = activeDocRef.current.pages[0];
    const newScale = (clientWidth - LEFT_MARGIN * 2) / firstPage.width;
    setScale(newScale);
    setPosition({ x: LEFT_MARGIN, y: TOP_MARGIN });
  };

  // Re-fit when switching documents
  useEffect(() => {
    fitToWidth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDocumentIndex]);

  // Set up ResizeObserver once — fitToWidth reads activeDoc via ref
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => fitToWidth());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
