import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import {
  FileSpreadsheet,
  Globe,
  Send,
  Cpu,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useAuditLogs, useAuditFacets } from './api';
import { useRequestExport } from '@/features/exports/api';
import { AuditQueryParams } from './schema';

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid rgb(var(--border))',
  backgroundColor: 'rgb(var(--background))',
  color: 'rgb(var(--foreground))',
  fontSize: '12.5px',
  fontWeight: 600,
  outline: 'none',
};

export const AuditPage = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<'' | 'WEB' | 'TELEGRAM' | 'SYSTEM'>('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportToast, setExportToast] = useState(false);

  const filters: AuditQueryParams = {
    page,
    limit: 25,
    q: search || undefined,
    channel: channel || undefined,
    entityType: entityType || undefined,
    action: action || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data, isLoading, isError } = useAuditLogs(filters);
  const { data: facets } = useAuditFacets();
  const exportMutation = useRequestExport();

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleResetFilters = () => {
    setSearch('');
    setChannel('');
    setEntityType('');
    setAction('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleExportE9 = () => {
    exportMutation.mutate(
      {
        type: 'E9',
        format: 'xlsx',
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          entityType: entityType || undefined,
          action: action || undefined,
          channel: channel || undefined,
          q: search || undefined,
        },
      },
      {
        onSuccess: () => {
          setExportToast(true);
          setTimeout(() => setExportToast(false), 4000);
        },
      }
    );
  };

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

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

        <Button style={{ gap: '6px' }} onClick={handleExportE9} disabled={exportMutation.isPending}>
          <FileSpreadsheet size={16} /> {exportMutation.isPending ? 'Yuborilmoqda...' : 'Audit eksporti (E9)'}
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
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--muted-foreground))' }} />
          <input
            type="text"
            placeholder="Qidiruv (amal, obyekt turi, ID)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: '6px',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '12.5px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Kanal:</label>
          <select
            value={channel}
            onChange={(e) => { setChannel(e.target.value as typeof channel); setPage(1); }}
            style={selectStyle}
          >
            <option value="">Barcha kanallar</option>
            <option value="WEB">🌐 Web ERP</option>
            <option value="TELEGRAM">📱 Telegram Bot</option>
            <option value="SYSTEM">⚙️ Tizim</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Obyekt turi:</label>
          <select
            value={entityType}
            onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">Barchasi</option>
            {facets?.entityTypes.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Amal:</label>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">Barchasi</option>
            {facets?.actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>Sana:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            style={{ ...selectStyle, fontWeight: 500 }}
          />
          <span style={{ color: 'rgb(var(--muted-foreground))' }}>—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            style={{ ...selectStyle, fontWeight: 500 }}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetFilters}
          style={{ color: 'rgb(var(--muted-foreground))', gap: '4px' }}
          title="Filtrlarni tozalash"
        >
          <RotateCcw size={14} /> Tozalash
        </Button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
            Ma'lumotlar yuklanmoqda...
          </div>
        ) : isError ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--destructive))' }}>
            Xatolik yuz berdi. Qayta urinib ko'ring.
          </div>
        ) : (
          <>
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
                {(data?.items ?? []).map((log) => {
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
                          {new Date(log.createdAt).toLocaleString('uz-UZ')}
                        </TableCell>
                        <TableCell style={{ fontWeight: 600 }}>
                          {log.userName || <span style={{ color: 'rgb(var(--muted-foreground))', fontWeight: 400 }}>Tizim</span>}
                        </TableCell>
                        <TableCell>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgb(var(--muted))',
                            fontFamily: 'JetBrains Mono',
                            fontWeight: 700
                          }}>
                            {log.entityType}{log.entityId ? ` (${log.entityId.slice(0, 8)})` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span style={{
                            fontSize: '11.5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: log.action.includes('approve') ? 'rgba(16, 185, 129, 0.15)' : log.action.includes('reject') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: log.action.includes('approve') ? '#059669' : log.action.includes('reject') ? '#dc2626' : '#2563eb',
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
                          ) : log.channel === 'TELEGRAM' ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: '#0284c7' }}>
                              <Send size={14} /> Telegram
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', color: 'rgb(var(--muted-foreground))' }}>
                              <Cpu size={14} /> Tizim
                            </span>
                          )}
                        </TableCell>
                        <TableCell style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                          {log.ip || '—'}
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

                              {log.changes && log.changes.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {log.changes.map((c, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: '160px 1fr 1fr',
                                        gap: '10px',
                                        alignItems: 'center',
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: '12px',
                                        padding: '6px 10px',
                                        borderRadius: '6px',
                                        backgroundColor: 'rgb(var(--card))',
                                        border: '1px solid rgb(var(--card-border))',
                                      }}
                                    >
                                      <span style={{ fontWeight: 700 }}>{c.field}</span>
                                      <span style={{ color: '#dc2626' }}>— {String(c.old ?? '(bo\'sh)')}</span>
                                      <span style={{ color: '#059669' }}>+ {String(c.new ?? '(bo\'sh)')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12.5px', color: 'rgb(var(--muted-foreground))' }}>
                                  Bu amal uchun maydon o'zgarishlari qayd etilmagan.
                                </span>
                              )}

                              {log.userRole && (
                                <span style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>
                                  Rol: <strong>{log.userRole}</strong>
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {(!data?.items || data.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'rgb(var(--muted-foreground))' }}>
                      Filtr bo'yicha hech qanday yozuv topilmadi.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: '1px solid rgb(var(--card-border))',
              fontSize: '12.5px',
              color: 'rgb(var(--muted-foreground))',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <span>
                Jami: <strong>{total}</strong> ta yozuvdan {total === 0 ? 0 : ((page - 1) * 25) + 1}–{Math.min(total, page * 25)} ko'rsatilmoqda
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ gap: '4px' }}
                >
                  <ChevronLeft size={16} /> Oldingi
                </Button>

                <span style={{ padding: '0 8px', fontWeight: 600 }}>
                  {page} / {totalPages}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ gap: '4px' }}
                >
                  Keyingi <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
