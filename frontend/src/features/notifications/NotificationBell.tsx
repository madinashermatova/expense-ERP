import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNotifications, useMarkAllAsRead } from './api';
import { useNavigate } from 'react-router-dom';
import styles from './NotificationBell.module.css';

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markReadMutation = useMarkAllAsRead();
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleItemClick = (item: any) => {
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <div className={styles.container} ref={menuRef}>
      <button className={styles.bellButton} onClick={() => setOpen(!open)} title="Bildirishnomalar">
        <Bell size={18} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.dropdown} style={{ width: '360px', boxShadow: 'var(--shadow-xl)', borderRadius: '12px' }}>
          <div className={styles.dropdownHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Bildirishnomalar</h4>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  backgroundColor: 'rgb(var(--primary-subtle))',
                  color: 'rgb(var(--primary))',
                  fontWeight: 700
                }}>
                  {unreadCount} ta yangi
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                className={styles.markReadBtn}
                onClick={() => markReadMutation.mutate()}
                style={{ fontSize: '11.5px', fontWeight: 600 }}
              >
                <Check size={13} /> O'qilgan deb belgilash
              </button>
            )}
          </div>

          <div className={styles.list} style={{ maxHeight: '340px' }}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>Yangi bildirishnomalar yo'q</div>
            ) : (
              notifications.slice(0, 10).map((n: any) => (
                <div
                  key={n.id}
                  className={styles.item}
                  onClick={() => handleItemClick(n)}
                  style={{
                    cursor: n.link ? 'pointer' : 'default',
                    backgroundColor: !n.isRead ? 'rgba(var(--primary), 0.04)' : undefined,
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ marginTop: '2px' }}>
                      {n.type === 'WARNING' ? (
                        <AlertTriangle size={16} color="#f59e0b" />
                      ) : n.type === 'SUCCESS' ? (
                        <CheckCircle2 size={16} color="#10b981" />
                      ) : (
                        <Info size={16} color="rgb(var(--primary))" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: !n.isRead ? 700 : 600, color: 'rgb(var(--foreground))' }}>
                          {n.title}
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>
                          {n.createdAt}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', margin: '3px 0 0', lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '8px 12px', backgroundColor: 'rgb(var(--muted))', textAlign: 'center', borderTop: '1px solid rgb(var(--border))' }}>
            <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
              Polling: har 30 soniyada yangilanadi
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
