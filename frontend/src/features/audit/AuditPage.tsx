import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import {
  ShieldCheck,
  FileSpreadsheet,
  Globe,
  Send,
  ChevronDown,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { AuditLog } from '@/mocks/data';

export const AuditPage = () => {
  const [logs, setLogs] = useState<AuditLog[]>(MockService.getAuditLogs());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [exportToast, setExportToast] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const filteredLogs = logs.filter(log => {
    if (selectedChannel !== 'ALL' && log.channel !== selectedChannel) return false;
    if (selectedEntity !== 'ALL' && log.entityType !== selectedEntity) return false;
    return true;
  });

  const handleExportE9 = () => {
    MockService.createExportJob('E9', 'xlsx', { channel: selectedChannel, entity: selectedEntity });
    setExportToast(true);
    setTimeout(() => setExportToast(false), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast */}
      {exportToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          padding: '14px 20px',
          borderRadius: '10px',
          backgroundColor: '#059669',
          color: 'white',
          fontWeight: 600,
          boxShadow: 'var(--shadow-xl)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={20} />
          Audit jurnali (E9) eksportga yuborildi!
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Audit va xavfsizlik jurnali</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Tizimdagi barcha foydalanuvchi amallari, tasdiqlashlar va o'zgarishlar tarixi
          </span>
        </div>

        <Button style={{ gap: '6px' }} onClick={handleExportE9}>
          <FileSpreadsheet size={16} /> Audit eksporti (E9)
        </Button>
      </div>

      {/* Filter Bar */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Kanal:</label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '12.5px',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="ALL">Barcha kanallar</option>
            <option value="WEB">🌐 Web ERP</option>
            <option value="TELEGRAM">📱 Telegram Bot</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Obyekt turi:</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '12.5px',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="ALL">Barchasi</option>
            <option value="EXPENSE">Xarajatlar (EXPENSE)</option>
            <option value="REFUND">Qaytarishlar (REFUND)</option>
            <option value="EMPLOYEE">Xodimlar (EMPLOYEE)</option>
            <option value="BRANCH">Filiallar (BRANCH)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '40px' }}></TableHead>
              <TableHead>Vaqt</TableHead>
              <TableHead>Foydalanuvchi</TableHead>
              <TableHead>Obyekt</TableHead>
              <TableHead>Amal</TableHead>
              <TableHead>Kanal</TableHead>
              <TableHead>IP manzil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <React.Fragment key={log.id}>
                  <TableRow
                    style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(var(--muted), 0.5)' : undefined }}
                    onClick={() => toggleExpand(log.id)}
                  >
                    <TableCell>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </TableCell>
                    <TableCell style={{ fontFamily: 'JetBrains Mono', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {log.timestamp}
                    </TableCell>
                    <TableCell style={{ fontWeight: 600 }}>{log.userName}</TableCell>
                    <TableCell>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgb(var(--muted))',
                        fontFamily: 'JetBrains Mono',
                        fontWeight: 700
                      }}>
                        {log.entityType} ({log.entityId})
                      </span>
                    </TableCell>
                    <TableCell>
                      <span style={{
                        fontSize: '11.5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: log.action === 'APPROVE' ? 'rgba(16, 185, 129, 0.15)' : log.action === 'REJECT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: log.action === 'APPROVE' ? '#059669' : log.action === 'REJECT' ? '#dc2626' : '#2563eb',
                        fontWeight: 700
                      }}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.channel === 'WEB' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}>
                          <Globe size={14} color="#3b82f6" /> Web
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: '#0284c7' }}>
                          <Send size={14} /> Telegram
                        </span>
                      )}
                    </TableCell>
                    <TableCell style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                      {log.ipAddress}
                    </TableCell>
                  </TableRow>

                  {/* Expandable Diff Row (TZ Section 6.15) */}
                  {isExpanded && (
                    <TableRow style={{ backgroundColor: 'rgba(var(--muted), 0.3)' }}>
                      <TableCell colSpan={7} style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'rgb(var(--muted-foreground))' }}>
                            O'zgarishlar diff tafsilotlari (Changes Diff):
                          </span>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            {/* Old value */}
                            <div style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              backgroundColor: 'rgba(239, 68, 68, 0.05)',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '12px'
                            }}>
                              <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: '6px' }}>— ESKI HOLAT (BEFORE):</div>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : 'Mavjud emas (Yangi yozuv)'}
                              </pre>
                            </div>

                            {/* New value */}
                            <div style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              backgroundColor: 'rgba(16, 185, 129, 0.05)',
                              fontFamily: 'JetBrains Mono',
                              fontSize: '12px'
                            }}>
                              <div style={{ color: '#059669', fontWeight: 700, marginBottom: '6px' }}>+ YANGI HOLAT (AFTER):</div>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                {log.newValue ? JSON.stringify(log.newValue, null, 2) : 'O\'chirildi'}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
