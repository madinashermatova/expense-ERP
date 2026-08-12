import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import {
  FileSpreadsheet,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FileText
} from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { ExportJob } from '@/mocks/data';

export const ExportHistoryPage = () => {
  const [jobs, setJobs] = useState<ExportJob[]>(MockService.getExportJobs());

  // Polling every 3s if any job is QUEUED or RUNNING (TZ Section 6.15a)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = MockService.getExportJobs();
      setJobs([...current]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleDownload = (job: ExportJob) => {
    // Simulated instant file download
    const blob = new Blob([`Expense ERP Export Report: ${job.typeName}\nFormat: ${job.format}\nRows: ${job.rowCount}\nDate: ${job.createdAt}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.type}_export_${Date.now()}.${job.format === 'xlsx' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Eksportlar tarixi (Oxirgi 24 soat)</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Generatsiya qilingan barcha Excel va PDF hisobot fayllari holati
          </span>
        </div>

        <Button variant="secondary" style={{ gap: '6px' }} onClick={() => setJobs(MockService.getExportJobs())}>
          <RefreshCw size={15} /> Yangilash
        </Button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hisobot turi</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Qatorlar soni</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead>Yaratilgan vaqt</TableHead>
              <TableHead>Amal qilish muddati</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Hujjat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {job.format === 'xlsx' ? <FileSpreadsheet size={18} color="#10b981" /> : <FileText size={18} color="#ef4444" />}
                    <div>
                      <div style={{ fontWeight: 700 }}>{job.typeName}</div>
                      <div style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontFamily: 'JetBrains Mono' }}>Kod: {job.type}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span style={{
                    fontSize: '11.5px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: job.format === 'xlsx' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: job.format === 'xlsx' ? '#059669' : '#dc2626',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}>
                    {job.format}
                  </span>
                </TableCell>
                <TableCell style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>
                  {job.rowCount} ta qator
                </TableCell>
                <TableCell>
                  {job.status === 'RUNNING' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontSize: '12.5px', fontWeight: 600 }}>
                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Tayyorlanmoqda...
                    </span>
                  )}
                  {job.status === 'QUEUED' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12.5px', fontWeight: 600 }}>
                      <Clock size={15} /> Navbatda
                    </span>
                  )}
                  {job.status === 'DONE' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12.5px', fontWeight: 600 }}>
                      <CheckCircle2 size={15} /> Tayyor
                    </span>
                  )}
                  {job.status === 'FAILED' && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '12.5px', fontWeight: 600 }}>
                      <XCircle size={15} /> Xatolik
                    </span>
                  )}
                </TableCell>
                <TableCell style={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}>
                  {job.createdAt}
                </TableCell>
                <TableCell style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                  24 soat ichida
                </TableCell>
                <TableCell style={{ textAlign: 'center' }}>
                  <Button
                    size="sm"
                    disabled={job.status !== 'DONE'}
                    onClick={() => handleDownload(job)}
                    style={{ gap: '6px' }}
                  >
                    <Download size={14} /> Yuklab olish
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
