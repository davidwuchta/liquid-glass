"use client";

import React, { useRef, useState } from "react";

interface DraggableProps {
  children: React.ReactNode;
  className?: string;
}

export function Draggable({ children, className = "" }: DraggableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const offset = useRef({ x: 0, y: 0 });
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      originX: offset.current.x,
      originY: offset.current.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || !ref.current) return;
    const x =
      dragStart.current.originX + (e.clientX - dragStart.current.pointerX);
    const y =
      dragStart.current.originY + (e.clientY - dragStart.current.pointerY);
    offset.current = { x, y };
    ref.current.style.left = `${x}px`;
    ref.current.style.top = `${y}px`;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    setIsDragging(false);
  };

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
    >
      {children}
    </div>
  );
}
