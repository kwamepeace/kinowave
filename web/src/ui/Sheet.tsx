import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog on wide screens. Escape or a backdrop click closes it. */
export function Sheet({ onClose, children, surface, label }: { onClose: () => void; children: ReactNode; surface?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`sheet ${surface ? 'surface' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {!surface && <span className="handle" />}
        <button className="icon-btn close press" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
        {children}
      </div>
    </div>
  );
}
