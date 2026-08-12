import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { MockService } from '@/mocks/mockService';

export const ReportsPage = () => {
  const [reportType, setReportType] = useState<'by-branch' | 'by-category' | 'by-employee' | 'budget-vs-actual'>('by-branch');
  const [period, setPeriod] = useState('2026-08');
  const [exportToast, setExportToast] = useState(false);

  // Dynamic report data sets
  const branchData = [
    { name: 'Mirobod filiali', count: 54, amount: 28900000, limit: 28000000, percent: 103 },
    { name: 'Chilonzor filiali', count: 48, amount: 24500000, limit: 30000000, percent: 81 },
    { name: 'Yunusobod filiali', count: 32, amount: 18200000, limit: 25000000, percent: 72 },
    { name: 'Samarqand filiali', count: 22, amount: 14200000, limit: 20000000, percent: 71 },
    { name: 'Namangan filiali', count: 21, amount: 12400000, limit: 18000000, percent: 68 },
    { name: 'Farg\'ona filiali', count: 19, amount: 11500000, limit: 16000000, percent: 71 },
    { name: 'Buxoro filiali', count: 18, amount: 9800000, limit: 15000000, percent: 65 },
  ];

  const categoryData = [
    { name: 'Marketing & Reklama', count: 35, amount: 42500000, color: '#3b82f6', percent: 28 },
    { name: 'Ofis & Ma\'muriy', count: 68, amount: 26800000, color: '#10b981', percent: 18 },
    { name: 'Transport & Yoqilg\'i', count: 44, amount: 19400000, color: '#f59e0b', percent: 13 },
    { name: 'IT & Uskunalar', count: 18, amount: 15600000, color: '#8b5cf6', percent: 10 },
    { name: 'Xizmat safari', count: 14, amount: 12300000, color: '#ec4899', percent: 8 },
    { name: 'Boshqa xarajatlar', count: 25, amount: 8900000, color: '#6b7280', percent: 6 },
  ];

  const employeeData = [
    { name: 'Farrux Shukurov', branch: 'Mirobod', count: 18, amount: 28400000, avg: 1577777 },
    { name: 'Sherzod Toirov', branch: 'Chilonzor', count: 24, amount: 22400000, avg: 933333 },
    { name: 'Zarina Normatova', branch: 'Chilonzor', count: 12, amount: 19800000, avg: 1650000 },
    { name: 'Alisher Qodirov', branch: 'Chilonzor', count: 15, amount: 18500000, avg: 1233333 },
    { name: 'Bobur Mirzayev', branch: 'Yunusobod', count: 9, amount: 16700000, avg: 1855555 },
    { name: 'Malika Usmonova', branch: 'Chilonzor', count: 14, amount: 14200000, avg: 1014285 },
    { name: 'Nigora Ahmedova', branch: 'Yunusobod', count: 11, amount: 12900000, avg: 1172727 },
  ];

  const exportCodeMap: Record<string, string> = {
    'by-branch': 'E2',
    'by-category': 'E3',
    'by-employee': 'E4',
    'budget-vs-actual': 'E5'
  };

  const handleExport = (format: 'xlsx' | 'pdf') => {
    const code = exportCodeMap[reportType] || 'E2';
    MockService.createExportJob(code, format, { period, reportType });
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
          Hisobot ({exportCodeMap[reportType]}) eksportga yuborildi! "Eksportlar tarixi"da yuklab olishingiz mumkin.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Hisobotlar konstruktori</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Filiallar, toifalar, xodimlar va byudjet ijrosi bo'yicha tahliliy hisobotlar
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" style={{ gap: '6px' }} onClick={() => handleExport('pdf')}>
            <Download size={15} /> PDF (E2-E5)
          </Button>
          <Button style={{ gap: '6px' }} onClick={() => handleExport('xlsx')}>
            <FileSpreadsheet size={15} /> Excel (E2-E5)
          </Button>
        </div>
      </div>

      {/* Constructor Filter Card */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgb(var(--muted-foreground))', textTransform: 'uppercase' }}>
            Hisobot turi
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '13.5px',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="by-branch">🏢 Filiallar kesimida tahlil (E2)</option>
            <option value="by-category">📁 Xarajat kategoriyalari ulushi (E3)</option>
            <option value="by-employee">👥 Xodimlar xarajatlari balansi (E4)</option>
            <option value="budget-vs-actual">⚖️ Byudjet va fakt taqqoslovi (E5)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'rgb(var(--muted-foreground))', textTransform: 'uppercase' }}>
            Hisobot davri
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '13.5px',
              fontWeight: 500,
              outline: 'none'
            }}
          >
            <option value="2026-08">Shu oy (Avgust 2026)</option>
            <option value="2026-07">O'tgan oy (Iyul 2026)</option>
            <option value="2026-Q3">3-Chorak 2026</option>
            <option value="2026">2026 Yillik umumiy</option>
          </select>
        </div>
      </div>

      {/* Dynamic Chart Container */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Vizual grafik tahlil</h3>
        <div style={{ height: '300px', width: '100%' }}>
          {reportType === 'by-branch' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(v))} UZS`, 'Sarf']} contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} />
                <Bar dataKey="amount" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {reportType === 'by-category' && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="amount">
                  {categoryData.map((c, i) => (
                    <Cell key={i} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(v))} UZS`, 'Summa']} contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {reportType === 'by-employee' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeData} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(v))} UZS`, 'Jami sarf']} contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {reportType === 'budget-vs-actual' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any, name: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(v))} UZS`, name === 'amount' ? 'Haqiqiy sarf' : 'Belgilangan limit']} contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="amount" name="Haqiqiy sarf" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="limit" name="Limit" fill="rgba(148, 163, 184, 0.4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdown Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Arizalar soni</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Jami summa</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Ulushi (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportType === 'by-branch' && branchData.map((b, i) => (
              <TableRow key={i}>
                <TableCell style={{ fontWeight: 600 }}>{b.name}</TableCell>
                <TableCell>{b.count} ta</TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  {new Intl.NumberFormat('uz-UZ').format(b.amount)} UZS
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>{b.percent}%</TableCell>
              </TableRow>
            ))}

            {reportType === 'by-category' && categoryData.map((c, i) => (
              <TableRow key={i}>
                <TableCell style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: c.color }} />
                  {c.name}
                </TableCell>
                <TableCell>{c.count} ta</TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  {new Intl.NumberFormat('uz-UZ').format(c.amount)} UZS
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 600 }}>{c.percent}%</TableCell>
              </TableRow>
            ))}

            {reportType === 'by-employee' && employeeData.map((e, i) => (
              <TableRow key={i}>
                <TableCell style={{ fontWeight: 600 }}>{e.name} <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>({e.branch})</span></TableCell>
                <TableCell>{e.count} ta</TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  {new Intl.NumberFormat('uz-UZ').format(e.amount)} UZS
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: '12.5px' }}>
                  o'rtacha: {new Intl.NumberFormat('uz-UZ').format(Math.round(e.avg))} UZS
                </TableCell>
              </TableRow>
            ))}

            {reportType === 'budget-vs-actual' && branchData.map((b, i) => (
              <TableRow key={i}>
                <TableCell style={{ fontWeight: 600 }}>{b.name}</TableCell>
                <TableCell>Limit: {new Intl.NumberFormat('uz-UZ').format(b.limit)} UZS</TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono', color: b.percent > 100 ? 'rgb(var(--destructive))' : 'rgb(var(--foreground))' }}>
                  {new Intl.NumberFormat('uz-UZ').format(b.amount)} UZS
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, color: b.percent > 100 ? 'rgb(var(--destructive))' : '#059669' }}>
                  {b.percent}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
