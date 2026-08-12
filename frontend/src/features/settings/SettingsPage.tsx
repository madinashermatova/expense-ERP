import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Navigate } from 'react-router-dom';
import {
  Settings,
  Coins,
  Calendar,
  Globe,
  Bell,
  Clock,
  Save,
  CheckCircle2
} from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuthStore();
  if (user?.role !== 'ADMIN' && user?.role !== 'PLATFORM_OWNER') {
    return <Navigate to="/" />;
  }

  // Settings State
  const [currencyBase, setCurrencyBase] = useState('UZS');
  const [reportPeriodStartDay, setReportPeriodStartDay] = useState(1);
  const [defaultLanguage, setDefaultLanguage] = useState('uz');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderHour, setReminderHour] = useState(18);
  const [editWindowHours, setEditWindowHours] = useState(24);

  const [isDirty, setIsDirty] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportPeriodStartDay < 1 || reportPeriodStartDay > 28) {
      alert("Hisobot davri boshlanish kuni 1 dan 28 gacha bo'lishi kerak!");
      return;
    }

    setIsDirty(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '840px' }}>
      {/* Toast */}
      {savedToast && (
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
          Tizim sozlamalari muvaffaqiyatli saqlandi!
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Tizim sozlamalari</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Hisob-kitob qoidalari, standart parametrlar va bildirishnoma muddatlari
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Section 1: Currency & Finance */}
        <div style={{
          backgroundColor: 'rgb(var(--card))',
          border: '1px solid rgb(var(--card-border))',
          borderRadius: 'var(--radius)',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid rgb(var(--border))' }}>
            <Coins size={20} color="rgb(var(--primary))" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Valyuta va moliyaviy hisob-kitob</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Asosiy hisob valyutasi (Baza)
              </label>
              <select
                value={currencyBase}
                onChange={(e) => { setCurrencyBase(e.target.value); setIsDirty(true); }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgb(var(--border))',
                  backgroundColor: 'rgb(var(--background))',
                  color: 'rgb(var(--foreground))',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              >
                <option value="UZS">UZS — O'zbekiston so'mi</option>
                <option value="USD">USD — AQSH dollari</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Hisobot davri boshlanish kuni (1–28)
              </label>
              <Input
                type="number"
                min={1}
                max={28}
                value={reportPeriodStartDay}
                onChange={(e) => { setReportPeriodStartDay(parseInt(e.target.value) || 1); setIsDirty(true); }}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Localization & Language */}
        <div style={{
          backgroundColor: 'rgb(var(--card))',
          border: '1px solid rgb(var(--card-border))',
          borderRadius: 'var(--radius)',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid rgb(var(--border))' }}>
            <Globe size={20} color="rgb(var(--primary))" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Til va hududiylik</h3>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Standart tizim tili
            </label>
            <select
              value={defaultLanguage}
              onChange={(e) => { setDefaultLanguage(e.target.value); setIsDirty(true); }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgb(var(--border))',
                backgroundColor: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
                fontSize: '13.5px',
                outline: 'none'
              }}
            >
              <option value="uz">O'zbekcha (Lotin)</option>
              <option value="ru">Русский</option>
            </select>
          </div>
        </div>

        {/* Section 3: Deadlines & Notifications */}
        <div style={{
          backgroundColor: 'rgb(var(--card))',
          border: '1px solid rgb(var(--card-border))',
          borderRadius: 'var(--radius)',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid rgb(var(--border))' }}>
            <Clock size={20} color="rgb(var(--primary))" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Muddatlar va bildirishnomalar</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Xarajatni tahrirlash oynasi (soatda)
              </label>
              <Input
                type="number"
                min={1}
                max={72}
                value={editWindowHours}
                onChange={(e) => { setEditWindowHours(parseInt(e.target.value) || 24); setIsDirty(true); }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Kunlik eslatma yuborish vaqti (soat)
              </label>
              <Input
                type="number"
                min={0}
                max={23}
                value={reminderHour}
                onChange={(e) => { setReminderHour(parseInt(e.target.value) || 18); setIsDirty(true); }}
                required
              />
            </div>
          </div>

          <div style={{ paddingTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => { setNotificationsEnabled(e.target.checked); setIsDirty(true); }}
              />
              Telegram bot orqali bildirishnomalar yuborish yoqilgan bo'lsin
            </label>
          </div>
        </div>

        {/* Save Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button
            type="submit"
            disabled={!isDirty}
            style={{ gap: '8px', padding: '10px 24px' }}
          >
            <Save size={16} /> Sozlamalarni saqlash
          </Button>
        </div>
      </form>
    </div>
  );
};
