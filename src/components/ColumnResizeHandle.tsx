import { useCallback, useRef, useState } from 'react';

interface ColumnResizeHandleProps {
  columnKey: string;
  onResize: (columnKey: string, newWidth: number) => void;
  currentWidth: number;
  minWidth?: number;
}

export function ColumnResizeHandle({
  columnKey,
  onResize,
  currentWidth,
  minWidth = 50
}: ColumnResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, startWidthRef.current + deltaX);
      onResize(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnKey, currentWidth, minWidth, onResize]);

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 ${
        isDragging ? 'bg-blue-500' : 'bg-transparent'
      } transition-colors z-10`}
      onMouseDown={handleMouseDown}
      title="Drag to resize column"
    />
  );
}
