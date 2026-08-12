import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Plus,
  Search,
  KeyRound,
  Send,
  Copy,
  Check,
  Eye,
  AlertCircle
} from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { Employee } from '@/mocks/data';

export const EmployeesPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  const isDirector = user?.role === 'DIRECTOR';

  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(isAdmin ? '' : (user?.branchId || 'b1'));
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [branchId, setBranchId] = useState(isAdmin ? '' : (user?.branchId || 'b1'));
  const [role, setRole] = useState<'ADMIN' | 'DIRECTOR' | 'WORKER'>('WORKER');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');

  const branches = MockService.getBranches('active');
  const employees = MockService.getEmployees(selectedBranch || undefined, statusFilter || undefined, search || undefined);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      alert("Iltimos, to'liq ism va emailni kiriting");
      return;
    }

    const res = MockService.createEmployee({
      fullName,
      position,
      branchId: branchId || 'b1',
      role: isDirector ? 'WORKER' : role, // Director only creates WORKER
      email,
      phone,
      telegramUsername
    });

    setIsCreateOpen(false);
    setTempPasswordModal(res.tempPassword);
    // Reset form
    setFullName('');
    setPosition('');
    setEmail('');
    setPhone('');
    setTelegramUsername('');
  };

  const handleResetPassword = (emp: Employee) => {
    if (window.confirm(`${emp.fullName} uchun parolni qayta tiklamoqchimisiz?`)) {
      const res = MockService.resetEmployeePassword(emp.id);
      setTempPasswordModal(res.tempPassword);
    }
  };

  const handleCopyPassword = () => {
    if (tempPasswordModal) {
      navigator.clipboard.writeText(tempPasswordModal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Xodimlar boshqaruvi</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Filial xodimlari, lavozimlar va Telegram bot foydalanuvchilari
          </span>
        </div>

        <Button style={{ gap: '6px' }} onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Yangi xodim qo'shish
        </Button>
      </div>

      {/* Filter Bar */}
      <div style={{
        backgroundColor: 'rgb(var(--card))',
        border: '1px solid rgb(var(--card-border))',
        borderRadius: 'var(--radius)',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--muted-foreground))' }} />
          <input
            type="text"
            placeholder="Qidiruv (ism, email, username)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {isAdmin && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid rgb(var(--border))',
              backgroundColor: 'rgb(var(--background))',
              color: 'rgb(var(--foreground))',
              fontSize: '13px',
              outline: 'none'
            }}
          >
            <option value="">Barcha filiallar</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid rgb(var(--border))',
            backgroundColor: 'rgb(var(--background))',
            color: 'rgb(var(--foreground))',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          <option value="">Barcha statuslar</option>
          <option value="active">Faol</option>
          <option value="inactive">Nofaol</option>
        </select>
      </div>

      {/* Employees Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>F.I.Sh.</TableHead>
              <TableHead>Filial / Lavozim</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Jami sarf</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmp(emp)}>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: 'rgb(var(--primary-subtle))',
                      color: 'rgb(var(--primary))',
                      fontWeight: 700,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {emp.fullName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{emp.fullName}</div>
                      <div style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>{emp.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div style={{ fontWeight: 500 }}>{emp.branchName}</div>
                  <div style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>{emp.position || 'Mutaxassis'}</div>
                </TableCell>
                <TableCell>
                  <span style={{
                    fontSize: '11.5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: emp.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.15)' : emp.role === 'DIRECTOR' ? 'rgba(16, 185, 129, 0.15)' : 'rgb(var(--muted))',
                    color: emp.role === 'ADMIN' ? '#2563eb' : emp.role === 'DIRECTOR' ? '#059669' : 'rgb(var(--foreground))',
                    fontWeight: 700
                  }}>
                    {emp.role}
                  </span>
                </TableCell>
                <TableCell>
                  {emp.telegramUsername ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontSize: '13px', fontWeight: 500 }}>
                      <Send size={14} /> {emp.telegramUsername}
                    </span>
                  ) : (
                    <span style={{ color: 'rgb(var(--muted-foreground))', fontSize: '12px' }}>Ulanmagan</span>
                  )}
                </TableCell>
                <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                  {new Intl.NumberFormat('uz-UZ').format(emp.totalExpenses)} UZS
                </TableCell>
                <TableCell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(emp)} title="Profilni ko'rish">
                      <Eye size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPassword(emp)}
                      title="Parolni tiklash"
                      style={{ color: '#d97706' }}
                    >
                      <KeyRound size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'rgb(var(--muted-foreground))' }}>
                  Xodimlar topilmadi.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Employee Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Yangi xodim qo'shish"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="To'liq ismi (F.I.Sh.)"
            placeholder="Alisher Qodirov"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Input
            label="Lavozimi"
            placeholder="Savdo menejeri"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />

          <Select
            label="Filial"
            value={branchId}
            disabled={isDirector}
            onChange={(e) => setBranchId(e.target.value)}
            required
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>

          <Select
            label="Tizimdagi roli"
            value={role}
            disabled={isDirector}
            onChange={(e) => setRole(e.target.value as any)}
            required
          >
            <option value="WORKER">Xodim (Worker - faqat Telegram bot)</option>
            {isAdmin && <option value="DIRECTOR">Direktor (Filial boshqaruvi)</option>}
            {isAdmin && <option value="ADMIN">Administrator (Barcha huquqlar)</option>}
          </Select>

          <Input
            label="Email manzil"
            type="email"
            placeholder="xodim@erp.uz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Telefon raqami"
            placeholder="+998901234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Telegram username"
            placeholder="@username"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit">
              Xodimni saqlash
            </Button>
          </div>
        </form>
      </Dialog>

      {/* One-Time Temporary Password Modal (TZ Section 6.9) */}
      <Dialog
        open={!!tempPasswordModal}
        onClose={() => setTempPasswordModal(null)}
        title="Vaqtinchalik parol yaratildi"
      >
        <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgb(var(--warning-subtle))',
            color: 'rgb(var(--warning-foreground))',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>
              <strong>Muhim ogohlantirish:</strong> Ushbu vaqtinchalik parol xavfsizlik maqsadida faqat bir marta ko'rsatiladi. Iltimos nusxalab xodimga yetkazing!
            </span>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'rgb(var(--muted))',
            borderRadius: 'var(--radius)',
            fontSize: '24px',
            fontFamily: 'JetBrains Mono',
            fontWeight: 800,
            letterSpacing: '3px',
            color: 'rgb(var(--primary))'
          }}>
            {tempPasswordModal}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <Button onClick={handleCopyPassword} style={{ gap: '6px' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Nusxalandi!' : 'Paroldan nusxa olish'}
            </Button>
            <Button variant="secondary" onClick={() => setTempPasswordModal(null)}>
              Yopish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Employee Detail Drawer */}
      <Dialog
        open={!!selectedEmp}
        onClose={() => setSelectedEmp(null)}
        title="Xodim profili va statistikasi"
      >
        {selectedEmp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingBottom: '12px', borderBottom: '1px solid rgb(var(--border))' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgb(var(--primary-subtle))',
                color: 'rgb(var(--primary))',
                fontSize: '18px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {selectedEmp.fullName.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{selectedEmp.fullName}</h3>
                <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                  {selectedEmp.position || 'Mutaxassis'} • {selectedEmp.branchName}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Email:</span>
                <div>{selectedEmp.email}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Telefon:</span>
                <div>{selectedEmp.phone || '+998901234567'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Telegram akkaunt:</span>
                <div style={{ color: '#0284c7', fontWeight: 600 }}>{selectedEmp.telegramUsername || 'Mavjud emas'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Ishga kirgan sana:</span>
                <div>{selectedEmp.hiredAt || '2023-01-15'}</div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              padding: '14px',
              borderRadius: 'var(--radius)',
              backgroundColor: 'rgb(var(--muted))'
            }}>
              <div>
                <span style={{ fontSize: '10.5px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Jami sarflar:</span>
                <div style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'JetBrains Mono' }}>
                  {new Intl.NumberFormat('uz-UZ').format(selectedEmp.totalExpenses)} UZS
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Shu oy:</span>
                <div style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'JetBrains Mono', color: 'rgb(var(--primary))' }}>
                  {new Intl.NumberFormat('uz-UZ').format(selectedEmp.currentMonthExpenses)} UZS
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10.5px', color: 'rgb(var(--muted-foreground))', fontWeight: 600 }}>Qaytarilgan:</span>
                <div style={{ fontWeight: 800, fontSize: '14px', fontFamily: 'JetBrains Mono', color: 'rgb(var(--success))' }}>
                  {new Intl.NumberFormat('uz-UZ').format(selectedEmp.refundedAmount)} UZS
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="ghost" onClick={() => setSelectedEmp(null)}>
                Yopish
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const emp = selectedEmp;
                  setSelectedEmp(null);
                  handleResetPassword(emp);
                }}
                style={{ gap: '6px' }}
              >
                <KeyRound size={16} /> Parolni yangilash
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
