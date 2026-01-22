import { useCallback, useRef, useState } from 'react';

interface RowResizeHandleProps {
  onResize: (newHeight: number) => void;
  currentHeight: number;
  minHeight?: number;
  maxHeight?: number;
}

export function RowResizeHandle({
  onResize,
  currentHeight,
  minHeight = 40,
  maxHeight = 320
}: RowResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = currentHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startYRef.current;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaY));
      onResize(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [currentHeight, minHeight, maxHeight, onResize]);

  return (
    <div
      className={`absolute left-0 right-0 bottom-0 h-1 cursor-row-resize hover:bg-blue-500 ${
        isDragging ? 'bg-blue-500' : 'bg-transparent'
      } transition-colors z-10`}
      onMouseDown={handleMouseDown}
      title="Drag to resize row height"
    />
  );
}
