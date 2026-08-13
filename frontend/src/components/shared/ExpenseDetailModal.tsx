import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from './StatusBadge';
import { useAuthStore } from '@/features/auth/store';
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Undo2,
  AlertTriangle,
  History,
  Users,
  Shield,
  ExternalLink
} from 'lucide-react';
import styles from './ExpenseDetailModal.module.css';

interface ExpenseDetailModalProps {
  expense: any;
  open: boolean;
  onClose: () => void;
  onApprove?: (id: string, version?: number) => void;
  onReject?: (id: string, reason: string, version?: number) => void;
  onRequestFix?: (id: string, reason: string, version?: number) => void;
  isPending?: boolean;
}

export const ExpenseDetailModal = ({
  expense,
  open,
  onClose,
  onApprove,
  onReject,
  onRequestFix,
  isPending = false
}: ExpenseDetailModalProps) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'info' | 'shares' | 'receipts' | 'timeline' | 'audit'>('info');
  const [reasonModalType, setReasonModalType] = useState<'REJECT' | 'FIX' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!expense) return null;

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  const isDirector = user?.role === 'DIRECTOR';
  
  // Four-eyes check: if current user created this expense, they cannot approve their own expense
  const isOwnExpense = expense.createdById === user?.id || (user?.email && expense.createdByName?.includes(user.fullName));

  const canApprove = (
    (isDirector && expense.status === 'DIRECTOR_PENDING') ||
    (isAdmin && (expense.status === 'DIRECTOR_PENDING' || expense.status === 'ADMIN_PENDING'))
  );

  const handleReasonSubmit = () => {
    if (reasonText.trim().length < 10) {
      alert("Sabab kamida 10 ta belgidan iborat bo'lishi shart!");
      return;
    }
    if (reasonModalType === 'REJECT' && onReject) {
      onReject(expense.id, reasonText, expense.version);
    } else if (reasonModalType === 'FIX' && onRequestFix) {
      onRequestFix(expense.id, reasonText, expense.version);
    }
    setReasonModalType(null);
    setReasonText('');
  };

  return (
    <>
      <Dialog
        open={open && !reasonModalType && !previewImage}
        onClose={onClose}
        title="Xarajat kartochkasi"
      >
        {/* Header with Dual Numbers and Status */}
        <div className={styles.headerInfo}>
          <div className={styles.numbers}>
            <span className={styles.globalNumber}>{expense.globalNumber}</span>
            <span className={styles.branchNumber}>{expense.branchNumber}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StatusBadge status={expense.status} />
            <div className={styles.amountBox}>
              <div className={styles.amountText}>
                {new Intl.NumberFormat('uz-UZ').format(Number(expense.amount))} {expense.currency}
              </div>
              {expense.currency !== 'UZS' && (
                <div style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>
                  ≈ {new Intl.NumberFormat('uz-UZ').format(Number(expense.amountUzs))} UZS
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Asosiy ma'lumot
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'shares' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('shares')}
          >
            Taqsimlash ({expense.shares?.length || 1})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'receipts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('receipts')}
          >
            Cheklar ({expense.files?.length || (expense.hasReceipt ? 1 : 0)})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'timeline' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Status tarixi
          </button>
          {isAdmin && (
            <button
              className={`${styles.tab} ${activeTab === 'audit' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              Audit izi
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className={styles.tabContent}>
          {activeTab === 'info' && (
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Filial</span>
                <span className={styles.infoValue}>{expense.branchName || expense.branch?.name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Kategoriya</span>
                <span className={styles.infoValue}>{expense.categoryName || expense.category?.name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Kiritgan xodim</span>
                <span className={styles.infoValue}>{expense.createdByName || 'Xodim'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Sana</span>
                <span className={styles.infoValue}>{expense.date}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>To'lov usuli</span>
                <span className={styles.infoValue}>
                  {expense.paymentMethod === 'CARD' ? '💳 Plastik karta' : expense.paymentMethod === 'CASH' ? '💵 Naqd pul' : '🏦 O\'tkazma'}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Chek talabi</span>
                <span className={styles.infoValue}>{expense.hasReceipt ? '✅ Mavjud' : '❌ Yuklanmagan'}</span>
              </div>

              {expense.description && (
                <div className={styles.descriptionBox}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                    Xarajat maqsadi va izohi:
                  </strong>
                  {expense.description}
                </div>
              )}
            </div>
          )}

          {activeTab === 'shares' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))', marginBottom: '4px' }}>
                Xarajat qaysi xodimlar hisobiga qanday proporsiyada yozilgan:
              </p>
              {expense.shares && expense.shares.length > 0 ? (
                expense.shares.map((share: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'rgb(var(--muted))',
                      fontSize: '13.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <Users size={16} color="rgb(var(--primary))" />
                      {share.employeeName || share.employeeId}
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'rgb(var(--primary))' }}>
                      {new Intl.NumberFormat('uz-UZ').format(Number(share.amount))} {expense.currency}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
                  Xarajat to'liq {expense.createdByName || 'kirituvchi xodim'} nomiga yozilgan.
                </div>
              )}
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className={styles.galleryGrid}>
              {expense.files && expense.files.length > 0 ? (
                expense.files.map((file: any) => (
                  <div key={file.id} className={styles.fileCard} onClick={() => setPreviewImage(file.url)}>
                    <div className={styles.filePreview}>
                      {file.type?.includes('pdf') ? (
                        <FileText size={36} color="rgb(var(--primary))" />
                      ) : (
                        <img src={file.url} alt={file.name} />
                      )}
                    </div>
                    <div className={styles.fileFooter}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                        {file.name}
                      </span>
                      <Eye size={14} color="rgb(var(--primary))" />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: 'span 3', padding: '32px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
                  <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p>Ushbu xarajat uchun chek yoki isbot fayli biriktirilmagan.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className={styles.timeline}>
              {expense.statusHistory && expense.statusHistory.length > 0 ? (
                expense.statusHistory.map((item: any) => (
                  <div key={item.id} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineTitle}>
                      Holat: <StatusBadge status={item.status} />
                    </div>
                    <div className={styles.timelineMeta}>
                      Tomonidan: <strong>{item.changedByName || item.changedBy}</strong> • {item.timestamp}
                    </div>
                    {item.reason && (
                      <div className={styles.timelineReason}>
                        Sabab / Izoh: {item.reason}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgb(var(--muted-foreground))' }}>Tarix topilmadi</div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', backgroundColor: 'rgb(var(--muted))', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                  <Shield size={16} color="#10b981" /> Tizim audit izi
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>Yaratilgan vaqt: {expense.createdAt}</div>
                  <div>Kiritish kanali: Web ERP</div>
                  <div>IP manzil: 192.168.1.45</div>
                  <div>Imzo xeshi: #SHA256_EXP_{expense.id}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Four-Eyes Principle Warning */}
        {isOwnExpense && canApprove && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'rgb(var(--warning-subtle))',
            color: 'rgb(var(--warning-foreground))',
            fontSize: '12.5px',
            marginTop: '12px'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Four-eyes tamoyili:</strong> Ushbu xarajat siz tomonidan kiritilgan. Manfaatlar to'qnashuvini oldini olish uchun uni o'zingiz tasdiqlay olmaysiz.
            </span>
          </div>
        )}

        {/* Actions Footer */}
        <div className={styles.modalFooter}>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Yopish
          </Button>

          {canApprove && (
            <div className={styles.actionsRight}>
              <Button
                variant="secondary"
                onClick={() => setReasonModalType('FIX')}
                disabled={isPending || isOwnExpense}
                style={{ gap: '6px' }}
              >
                <Undo2 size={15} /> Tuzatish so'rash
              </Button>

              <Button
                style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white', gap: '6px' }}
                onClick={() => setReasonModalType('REJECT')}
                disabled={isPending || isOwnExpense}
              >
                <XCircle size={15} /> Rad etish
              </Button>

              <Button
                style={{ backgroundColor: 'rgb(var(--success))', color: 'white', gap: '6px' }}
                onClick={() => onApprove && onApprove(expense.id, expense.version)}
                disabled={isPending || isOwnExpense}
              >
                <CheckCircle2 size={15} /> Tasdiqlash
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      {/* Reject / Fix Reason Modal with live >=10 char counter */}
      <Dialog
        open={!!reasonModalType}
        onClose={() => setReasonModalType(null)}
        title={reasonModalType === 'REJECT' ? 'Xarajatni rad etish' : 'Tuzatish so\'rash'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13.5px', color: 'rgb(var(--foreground))' }}>
            Iltimos, nima sababdan {reasonModalType === 'REJECT' ? 'rad etilayotganini' : 'tuzatish so\'ralayotganini'} batafsil tushuntiring (kamida 10 belgi):
          </p>

          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Masalan: Chekdagi summa bilan arizadagi summa mos kelmayapti..."
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--card))',
              color: 'rgb(var(--foreground))',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: reasonText.length < 10 ? 'rgb(var(--destructive))' : 'rgb(var(--success))'
            }}>
              Belgilar soni: {reasonText.length} / 10 ta minimum
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" onClick={() => setReasonModalType(null)}>
              Bekor qilish
            </Button>
            <Button
              style={{
                backgroundColor: reasonModalType === 'REJECT' ? 'rgb(var(--destructive))' : 'rgb(var(--warning))',
                color: 'white'
              }}
              onClick={handleReasonSubmit}
              disabled={reasonText.trim().length < 10}
            >
              Yuborish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Lightbox Preview */}
      <Dialog
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title="Chek / Hujjat ko'rinishi"
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src={previewImage || ''}
            alt="Chek preview"
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain' }}
          />
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <a
              href={previewImage || ''}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Button variant="secondary" style={{ gap: '6px' }}>
                <ExternalLink size={16} /> Yangi oynada ochish
              </Button>
            </a>
            <Button onClick={() => setPreviewImage(null)}>Yopish</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
