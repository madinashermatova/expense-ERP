import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
<<<<<<< HEAD
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Undo2, CheckCircle2, XCircle, Eye, FileText, ArrowRight } from 'lucide-react';
import { useRefunds, useApproveRefund, useRejectRefund } from './api';
import { RefundForm } from './components/RefundForm';
import { MockService } from '@/mocks/mockService';
=======
import { Plus } from 'lucide-react';
import { useRefunds, useApproveRefund, useRejectRefund } from './api';
import { RefundForm } from './components/RefundForm';
import { Check, X } from 'lucide-react';
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
import styles from './RefundsPage.module.css';

export const RefundsPage = () => {
  const { t } = useTranslation(['refunds', 'common']);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
<<<<<<< HEAD
  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);

  const { data, isLoading, refetch } = useRefunds(activeTab);
  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();

  const refundsList = MockService.getRefunds();
  const filteredList = activeTab === 'ALL' ? refundsList : refundsList.filter(r => r.status === activeTab);

  const handleApprove = (id: string) => {
    MockService.approveRefund(id);
    setSelectedRefund(null);
    refetch();
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting:");
    if (reason && reason.length >= 10) {
      MockService.rejectRefund(id, reason);
      setSelectedRefund(null);
      refetch();
=======
  
  const { data, isLoading } = useRefunds(activeTab);
  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason });
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Qaytarish so'rovlari (Refunds)</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Xarajatlardan ortib qolgan yoki qaytarilgan mablag'lar hisobi
          </span>
        </div>

        <Button style={{ gap: '8px' }} onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Yangi qaytarish kiritish
        </Button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { id: 'ALL', label: 'Barchasi', count: refundsList.length },
          { id: 'PENDING', label: 'Kutilmoqda', count: refundsList.filter(r => r.status === 'PENDING').length },
          { id: 'APPROVED', label: 'Tasdiqlangan', count: refundsList.filter(r => r.status === 'APPROVED').length },
          { id: 'REJECTED', label: 'Rad etilgan', count: refundsList.filter(r => r.status === 'REJECTED').length },
        ].map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '999px',
              backgroundColor: 'rgb(var(--muted))',
              fontWeight: 700
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asl xarajat</TableHead>
              <TableHead>Filial / Xodim</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Qaytarish summasi</TableHead>
              <TableHead>Turi</TableHead>
              <TableHead>Sabab</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map((item: any) => (
              <TableRow key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRefund(item)}>
                <TableCell>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                    {item.expenseGlobalNumber}
                  </span>
                </TableCell>
<<<<<<< HEAD
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{item.employeeName}</div>
                  <div style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>{item.branchName}</div>
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'rgb(var(--success))' }}>
                  +{new Intl.NumberFormat('uz-UZ').format(Number(item.amount))} UZS
                </TableCell>
                <TableCell>
                  <span style={{
                    fontSize: '11.5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: item.isPartial ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: item.isPartial ? '#d97706' : '#059669',
                    fontWeight: 600
                  }}>
                    {item.isPartial ? 'Qisman qaytarish' : 'To\'liq qaytarish'}
                  </span>
                </TableCell>
                <TableCell style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.reason}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRefund(item)}>
                      <Eye size={16} />
                    </Button>
                    {item.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          style={{ backgroundColor: 'rgb(var(--success))', color: 'white' }}
                          onClick={() => handleApprove(item.id)}
                          title="Tasdiqlash"
                        >
                          <CheckCircle2 size={15} />
                        </Button>
                        <Button
                          size="sm"
                          style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white' }}
                          onClick={() => handleReject(item.id)}
                          title="Rad etish"
                        >
                          <XCircle size={15} />
                        </Button>
                      </>
                    )}
                  </div>
=======
                <TableCell>{item.reason}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleApprove(item.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        style={{ color: 'rgb(var(--success))' }}
                      >
                        <Check size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReject(item.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        style={{ color: 'rgb(var(--destructive))' }}
                      >
                        <X size={18} />
                      </Button>
                    </div>
                  )}
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
                </TableCell>
              </TableRow>
            ))}
            {filteredList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'rgb(var(--muted-foreground))' }}>
                  Qaytarish so'rovlari topilmadi.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Modal */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Yangi qaytarish so'rovi yaratish"
      >
        <RefundForm
          onSuccess={() => { setIsCreateOpen(false); refetch(); }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Dialog>

      {/* Refund Detail Modal */}
      <Dialog
        open={!!selectedRefund}
        onClose={() => setSelectedRefund(null)}
        title="Qaytarish ma'lumotlari"
      >
        {selectedRefund && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13.5px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Asl xarajat:</span>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                  {selectedRefund.expenseGlobalNumber}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Qaytarish summasi:</span>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: '16px', color: 'rgb(var(--success))' }}>
                  {new Intl.NumberFormat('uz-UZ').format(Number(selectedRefund.amount))} UZS
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Xodim:</span>
                <div style={{ fontWeight: 600 }}>{selectedRefund.employeeName}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Filial:</span>
                <div style={{ fontWeight: 600 }}>{selectedRefund.branchName}</div>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'rgb(var(--muted))', fontSize: '13px' }}>
              <strong>Qaytarish sababi:</strong>
              <p style={{ marginTop: '4px' }}>{selectedRefund.reason}</p>
            </div>

            {selectedRefund.files && selectedRefund.files.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Isbot cheki:</span>
                <div style={{ marginTop: '6px', width: '120px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgb(var(--border))' }}>
                  <img src={selectedRefund.files[0].url} alt="Chek" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="ghost" onClick={() => setSelectedRefund(null)}>
                Yopish
              </Button>
              {selectedRefund.status === 'PENDING' && (
                <>
                  <Button
                    style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white' }}
                    onClick={() => handleReject(selectedRefund.id)}
                  >
                    Rad etish
                  </Button>
                  <Button
                    style={{ backgroundColor: 'rgb(var(--success))', color: 'white' }}
                    onClick={() => handleApprove(selectedRefund.id)}
                  >
                    Tasdiqlash
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
