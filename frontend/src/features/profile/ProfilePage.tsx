import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/store';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export const ProfilePage = () => {
  const { t, i18n } = useTranslation(['common']);
  const { user } = useAuthStore();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600 }}>Mening profilim</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'rgb(var(--card))', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
        <Input label="F.I.Sh" value={user?.fullName || ''} readOnly disabled />
        <Input label="Email / Login" value={user?.login || ''} readOnly disabled />
        <Input label="Rol" value={user?.role || ''} readOnly disabled />
        
        <Select label="Til" value={i18n.language} onChange={handleLanguageChange}>
          <option value="uz">O'zbekcha</option>
          <option value="ru">Русский</option>
        </Select>

        <Select label="Tema" value={theme} onChange={handleThemeChange}>
          <option value="system">Tizim</option>
          <option value="light">Yorug' (Light)</option>
          <option value="dark">Qorong'u (Dark)</option>
        </Select>

        <div style={{ marginTop: '16px', borderTop: '1px solid rgb(var(--border))', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Parolni o'zgartirish</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Eski parol" type="password" />
            <Input label="Yangi parol" type="password" />
            <Button style={{ alignSelf: 'flex-start' }}>Saqlash</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
