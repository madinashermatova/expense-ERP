import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Coins, Plus, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { CurrencyRate } from '@/mocks/data';

export const CurrencyPage = () => {
  const [rates, setRates] = useState<CurrencyRate[]>(MockService.getCurrencyRates());
  const [baseMode, setBaseMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [isModeChangeOpen, setIsModeChangeOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'RUB'>('USD');
  const [rate, setRate] = useState('12850');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    MockService.addCurrencyRate({
      date,
      currency,
      rate: parseFloat(rate) || 12850
    });
    setRates(MockService.getCurrencyRates());
    setIsAddOpen(false);
  };

  const handleToggleMode = () => {
    const next = baseMode === 'AUTO' ? 'MANUAL' : 'AUTO';
    setBaseMode(next);
    setIsModeChangeOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Valyuta kurslari boshqaruvi</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Markaziy Bank (CBU) integratsiyasi va qo'lda belgilangan hisob kurslari
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" style={{ gap: '6px' }} onClick={() => setIsModeChangeOpen(true)}>
            <RefreshCw size={15} /> Hisoblash rejimi: <strong>{baseMode}</strong>
          </Button>

          <Button style={{ gap: '6px' }} onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Qo'lda kurs kiritish
          </Button>
        </div>
      </div>

      {/* Mode Banner */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 'var(--radius)',
        backgroundColor: baseMode === 'AUTO' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${baseMode === 'AUTO' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13.5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Coins size={20} color={baseMode === 'AUTO' ? '#059669' : '#d97706'} />
          <span>
            Joriy hisoblash bazasi: <strong>{baseMode === 'AUTO' ? 'AVTOMATIK (MB kursi asosida)' : 'QO\'LDA (Manual kurs asosida)'}</strong>
          </span>
        </div>

        <Button size="sm" variant="ghost" onClick={() => setIsModeChangeOpen(true)}>
          Rejimni o'zgartirish
        </Button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana</TableHead>
              <TableHead>Valyuta</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Kurs (1 birlik = UZS)</TableHead>
              <TableHead>Manba</TableHead>
              <TableHead>Holati</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((r) => (
              <TableRow key={r.id}>
                <TableCell style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{r.date}</TableCell>
                <TableCell style={{ fontWeight: 700 }}>{r.currency}</TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono', color: 'rgb(var(--primary))' }}>
                  {new Intl.NumberFormat('uz-UZ').format(r.rate)} UZS
                </TableCell>
                <TableCell>
                  <span style={{
                    fontSize: '11.5px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: r.source === 'CBU' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: r.source === 'CBU' ? '#059669' : '#d97706',
                    fontWeight: 700
                  }}>
                    {r.source === 'CBU' ? '🏦 Markaziy Bank (CBU)' : '✍️ Qo\'lda kiritilgan'}
                  </span>
                </TableCell>
                <TableCell>
                  {r.source === 'MANUAL' ? (
                    <span style={{ fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} /> CBU dan olinmagan kun
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> Rasmiy tasdiqlangan
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Rate Dialog */}
      <Dialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Qo'lda valyuta kursi kiritish"
      >
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Sana"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Select
            label="Valyuta turi"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as any)}
            required
          >
            <option value="USD">USD (AQSH dollari)</option>
            <option value="EUR">EUR (Yevro)</option>
            <option value="RUB">RUB (Rossiya rubli)</option>
          </Select>

          <Input
            label="Kurs miqdori (1 valyuta necha so'm)"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit">
              Kursni saqlash
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Mode Change Confirmation Dialog (TZ Section 6.13) */}
      <Dialog
        open={isModeChangeOpen}
        onClose={() => setIsModeChangeOpen(false)}
        title="Hisoblash bazasi rejimini o'zgartirish"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d97706' }}>
            <AlertTriangle size={32} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgb(var(--foreground))' }}>
              Hisoblash rejimini <strong>{baseMode === 'AUTO' ? 'MANUAL' : 'AUTO'}</strong> ga o'zgartirmoqchimisiz?
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))', lineHeight: 1.5 }}>
            Bu o'zgarish barcha yangi kiritiladigan xarajatlarning UZS ekvivalentini avtomatik konvertatsiya qilish jarayoniga to'g'ridan-to'g'ri ta'sir qiladi.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" onClick={() => setIsModeChangeOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleToggleMode}>
              Ha, o'zgartirish
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
