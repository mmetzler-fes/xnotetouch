import { useState, useEffect } from 'react';
import { useUiStore } from '../../../stores/uiStore';

/** Left edge of the page must never go left of this screen-space offset (px). */
const LEFT_MARGIN = 20;

/**
 * Handles zoom-via-wheel (Ctrl+Scroll) and vertical scroll, plus Space-to-pan.
 * The left edge of the page is clamped to LEFT_MARGIN so it never disappears
 * off-screen to the left when zooming in.
 */
export function useZoomPan() {
  const { setScale, setPosition } = useUiStore();
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    // Always read from store to avoid stale-closure issues
    const { scale: oldScale, position } = useUiStore.getState();

    if (e.evt.ctrlKey) {
      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const scaleBy = 1.1;
      const newScale = e.evt.deltaY < 0
        ? oldScale * scaleBy
        : oldScale / scaleBy;

      if (newScale < 0.05 || newScale > 10) return;

      // Clamp x so the left page edge never slides past the left margin
      const newX = Math.max(LEFT_MARGIN, pointer.x - mousePointTo.x * newScale);
      const newY = pointer.y - mousePointTo.y * newScale;

      setScale(newScale);
      setPosition({ x: newX, y: newY });
    } else {
      // Plain scroll → pan vertically
      setPosition({ x: position.x, y: position.y - e.evt.deltaY });
    }
  };

  return { handleWheel, isSpacePressed };
}
