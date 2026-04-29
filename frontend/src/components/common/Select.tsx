import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string | number;
  label: string | number;
}

interface Props {
  value: string | number;
  options: Option[];
  onChange: (value: any) => void;
  width?: string;
}

function getDropdownPos(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < 240 && rect.top > 240;
  return {
    top:    openUp ? rect.top + window.scrollY - 240 - 4 : rect.bottom + window.scrollY + 4,
    left:   rect.left + window.scrollX,
    width:  rect.width,
    openUp,
  };
}

export const Select = ({ value, options, onChange, width = '120px' }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 120, openUp: false });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (triggerRef.current) setPos(getDropdownPos(triggerRef.current));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
    window.addEventListener('resize', updatePos, { passive: true });
    window.addEventListener('scroll', updatePos, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isOpen, updatePos]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const selected = options.find(o => o.value === value);

  const dropdown = isOpen && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'absolute',
        top:   pos.top,
        left:  pos.left,
        width: pos.width,
        background: '#1e293b',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
        zIndex: 2147483647,
        overflow: 'hidden',
        animation: 'fadeIn 0.12s ease-out',
        maxHeight: '240px',
        overflowY: 'auto',
      }}
    >
      {options.map(opt => (
        <div
          key={opt.value}
          onClick={() => { onChange(opt.value); setIsOpen(false); }}
          style={{
            padding: '10px 14px', fontSize: '13px',
            fontWeight: opt.value === value ? 700 : 500,
            color: opt.value === value ? '#818cf8' : '#cbd5e1',
            background: opt.value === value ? 'rgba(99,102,241,0.1)' : 'transparent',
            cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
        >
          {opt.label}
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', borderRadius: '8px', width,
          background: 'rgba(15,23,42,0.9)', color: '#e2e8f0',
          border: isOpen ? '1px solid #6366f1' : '1px solid rgba(99,102,241,0.25)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(99,102,241,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <span>{selected?.label ?? value}</span>
        <svg
          style={{ color: '#6366f1', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {dropdown}
    </>
  );
};
