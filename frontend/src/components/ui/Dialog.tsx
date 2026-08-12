import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Dialog = ({ open, onClose, title, children }: DialogProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.content} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        {title && (
          <div className={styles.header}>
            <h2 id="dialog-title" className={styles.title}>{title}</h2>
            <button className={styles.closeButton} onClick={onClose} aria-label="Yopish">
              <X size={20} />
            </button>
          </div>
        )}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
