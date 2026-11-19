'use client';

import { useEffect, useRef, useState } from 'react';
import { WRITING_CHARS } from '@/lib/modules';

export default function WritingPage() {
  const [charIdx, setCharIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const red =
      getComputedStyle(document.documentElement).getPropertyValue('--red').trim() ||
      '#b1342b';
    ctx.strokeStyle = red;
  };

  useEffect(() => {
    clearCanvas();
  }, [charIdx]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Luyện viết chữ Hán</h2>
      <div className="row" style={{ margin: '0 0 14px' }}>
        {WRITING_CHARS.map((ch, idx) => (
          <button
            key={ch}
            type="button"
            className={`chip han ${idx === charIdx ? 'active' : ''}`}
            onClick={() => setCharIdx(idx)}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="pad">
        <div className="ghost han">{WRITING_CHARS[charIdx]}</div>
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            drawingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = e.currentTarget.getContext('2d');
            if (!ctx) return;
            const [x, y] = getPoint(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawingRef.current) return;
            const ctx = e.currentTarget.getContext('2d');
            if (!ctx) return;
            const [x, y] = getPoint(e);
            ctx.lineTo(x, y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawingRef.current = false;
          }}
          onPointerCancel={() => {
            drawingRef.current = false;
          }}
        />
      </div>

      <div className="row">
        <button type="button" className="btn alt" onClick={clearCanvas}>
          Xóa viết lại
        </button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Viết đè lên nét mờ bằng ngón tay hoặc chuột để luyện thứ tự và bố cục chữ Hán.
      </p>
    </>
  );
}
