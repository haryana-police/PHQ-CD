import { useState, useRef, useEffect } from 'react';

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

export const Select = ({ value, options, onChange, width = '120px' }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', borderRadius: '8px',
          background: 'rgba(15,23,42,0.9)', color: '#e2e8f0',
          border: isOpen ? '1px solid #6366f1' : '1px solid rgba(99,102,241,0.25)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(99,102,241,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
        }}
      >
        <span>{selected?.label || value}</span>
        <svg 
          style={{ 
            color: '#6366f1', 
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'none' 
          }} 
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 50, overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              style={{
                padding: '10px 14px', fontSize: '13px', fontWeight: opt.value === value ? 700 : 500,
                color: opt.value === value ? '#818cf8' : '#cbd5e1',
                background: opt.value === value ? 'rgba(99,102,241,0.1)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
              onMouseEnter={e => {
                if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                if (opt.value !== value) e.currentTarget.style.background = 'transparent';
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
