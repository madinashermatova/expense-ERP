import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/store';
import { useThemeStore } from '@/lib/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  KeyRound,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { i18n } = useTranslation();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordToast, setPasswordToast] = useState(false);

  const handleLanguageChange = (lang: string) => {
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      alert("Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Yangi parollar mos kelmadi!");
      return;
    }

    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordToast(true);
    setTimeout(() => setPasswordToast(false), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '680px' }}>
      {passwordToast && (
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
          Parol muvaffaqiyatli yangilandi!
        </div>
      )}

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Shaxsiy profil va sozlamalar</h2>
        <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
          Hisob ma'lumotlari, shaxsiy til va xavfsizlik
        </span>
      </div>

      {/* User Info Card */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid rgb(var(--border))' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgb(var(--primary)), #8b5cf6)',
            color: 'white',
            fontWeight: 800,
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(43, 85, 215, 0.25)'
          }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{user?.fullName}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11.5px',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgb(var(--primary-subtle))',
                color: 'rgb(var(--primary))',
                fontWeight: 700
              }}>
                👑 {user?.role}
              </span>
              <span style={{ fontSize: '12.5px', color: 'rgb(var(--muted-foreground))' }}>
                🏢 {user?.branchName || 'Chilonzor filiali'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Input label="F.I.Sh (To'liq ism)" value={user?.fullName || ''} readOnly disabled />
          <Input label="Login / Email" value={user?.email || user?.login || ''} readOnly disabled />
        </div>

        {/* Preferences */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', paddingTop: '10px', borderTop: '1px solid rgb(var(--border))' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Interfeys tili
            </label>
            <select
              value={i18n.language}
              onChange={(e) => handleLanguageChange(e.target.value)}
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
              <option value="uz">🇺🇿 O'zbekcha</option>
              <option value="ru">🇷🇺 Русский</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Mavzu (Tema)
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
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
              <option value="light">☀️ Yorug' (Light)</option>
              <option value="dark">🌙 Tungi (Dark)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Password Change Form */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={18} color="rgb(var(--primary))" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Parolni o'zgartirish</h3>
        </div>

        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="Eski parol"
            type="password"
            placeholder="••••••••"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            required
          />

          <Input
            label="Yangi parol (Kamida 8 belgi)"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Yangi parolni tasdiqlang"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Button type="submit" style={{ gap: '6px' }}>
              <KeyRound size={15} /> Parolni saqlash
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
