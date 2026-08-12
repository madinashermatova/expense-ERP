import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileEdit, CheckCircle2, XCircle, Eye, ArrowRight, GitCompare } from 'lucide-react';
import { useEditRequests } from './api';
import { MockService } from '@/mocks/mockService';
import styles from './EditRequestsPage.module.css';

export const EditRequestsPage = () => {
  const { t } = useTranslation(['editRequests', 'common']);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPLIED' | 'REJECTED'>('ALL');
  const [selectedReq, setSelectedReq] = useState<any | null>(null);

  const { refetch } = useEditRequests();
  const reqsList = MockService.getEditRequests();
  const filtered = activeTab === 'ALL' ? reqsList : reqsList.filter(r => r.status === activeTab);

  const handleApply = (id: string) => {
    MockService.applyEditRequest(id);
    setSelectedReq(null);
    refetch();
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababi (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      MockService.rejectEditRequest(id, reason);
      setSelectedReq(null);
      refetch();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Tahrirlash murojaatlari (Edit Requests)
          </h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Xodimlar tomonidan 24 soatlik muddatda yuborilgan tuzatish so'rovlari
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgb(var(--border))', paddingBottom: '0' }}>
        {[
          { id: 'ALL', label: 'Barchasi', count: reqsList.length },
          { id: 'PENDING', label: 'Kutilmoqda', count: reqsList.filter(r => r.status === 'PENDING').length },
          { id: 'APPLIED', label: 'Qo\'llangan', count: reqsList.filter(r => r.status === 'APPLIED').length },
          { id: 'REJECTED', label: 'Rad etilgan', count: reqsList.filter(r => r.status === 'REJECTED').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'rgb(var(--primary))' : 'transparent'}`,
              color: activeTab === tab.id ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
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
              <TableHead>Xarajat №</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>So'ragan xodim</TableHead>
              <TableHead>Tuzatish sababi</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item: any) => (
              <TableRow key={item.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedReq(item)}>
                <TableCell>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                    {item.expenseGlobalNumber}
                  </span>
                </TableCell>
                <TableCell>{item.branchName}</TableCell>
                <TableCell style={{ fontWeight: 600 }}>{item.requestedByName}</TableCell>
                <TableCell style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.reason}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedReq(item)}>
                      <Eye size={16} />
                    </Button>
                    {item.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          style={{ backgroundColor: 'rgb(var(--success))', color: 'white' }}
                          onClick={() => handleApply(item.id)}
                          title="Qo'llash"
                        >
                          <CheckCircle2 size={15} /> Qo'llash
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
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'rgb(var(--muted-foreground))' }}>
                  Tahrirlash murojaatlari topilmadi.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Comparison Modal */}
      <Dialog
        open={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title="Tahrirlash murojaatini taqqoslash"
      >
        {selectedReq && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgb(var(--border))' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Xarajat:</span>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                  {selectedReq.expenseGlobalNumber}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>So'rovchi:</span>
                <div style={{ fontWeight: 600 }}>{selectedReq.requestedByName}</div>
              </div>
            </div>

            <div style={{ padding: '12px', borderRadius: 'var(--radius)', backgroundColor: 'rgb(var(--muted))', fontSize: '13px' }}>
              <strong>Xodim bayon qilgan sabab:</strong>
              <p style={{ marginTop: '4px' }}>{selectedReq.reason}</p>
            </div>

            {/* Visual Diff Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                  Eski ma'lumot:
                </span>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div>Summa: <strong>{selectedReq.originalData?.amount} UZS</strong></div>
                  <div style={{ marginTop: '4px', color: 'rgb(var(--muted-foreground))' }}>{selectedReq.originalData?.description}</div>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: 'var(--radius)', border: '1px solid rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  Yangi so'ralgan ma'lumot:
                </span>
                <div style={{ marginTop: '8px', fontSize: '13px' }}>
                  <div>Summa: <strong>{selectedReq.requestedData?.amount} UZS</strong></div>
                  <div style={{ marginTop: '4px', color: 'rgb(var(--foreground))' }}>{selectedReq.requestedData?.description}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="ghost" onClick={() => setSelectedReq(null)}>
                Yopish
              </Button>
              {selectedReq.status === 'PENDING' && (
                <>
                  <Button
                    style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white' }}
                    onClick={() => handleReject(selectedReq.id)}
                  >
                    Rad etish
                  </Button>
                  <Button
                    style={{ backgroundColor: 'rgb(var(--success))', color: 'white' }}
                    onClick={() => handleApply(selectedReq.id)}
                  >
                    Qo'llash (Tasdiqlash)
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
