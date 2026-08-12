import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNotifications, useMarkAllAsRead } from './api';
import styles from './NotificationBell.module.css';

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markReadMutation = useMarkAllAsRead();
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={styles.container} ref={menuRef}>
      <button className={styles.bellButton} onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h4>Bildirishnomalar</h4>
            {unreadCount > 0 && (
              <button className={styles.markReadBtn} onClick={() => markReadMutation.mutate()}>
                <Check size={14} /> Hammasini o'qilgan deb belgilash
              </button>
            )}
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>Yangi bildirishnomalar yo'q</div>
            ) : (
              notifications.slice(0, 10).map((n: any, i: number) => (
                <div key={n.id || i} className={styles.item}>
                  <div className={styles.itemTitle}>{n.title || 'Bildirishnoma'}</div>
                  <div className={styles.itemTime}>{new Date(n.createdAt || Date.now()).toLocaleTimeString()}</div>
                </div>
              ))
            )}
          </div>
          <button className={styles.viewAllBtn}>Barchasini ko'rish</button>
        </div>
      )}
    </div>
  );
};
