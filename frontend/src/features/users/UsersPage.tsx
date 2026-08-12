import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Users2, Shield, KeyRound, UserCheck, UserX, CheckCircle2 } from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { Employee } from '@/mocks/data';

export const UsersPage = () => {
  const [usersList, setUsersList] = useState<Employee[]>(
    MockService.getEmployees().filter(e => e.role !== 'PLATFORM_OWNER')
  );
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(null);

  const handleToggleStatus = (user: Employee) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    user.status = nextStatus;
    setUsersList([...usersList]);
  };

  const handleRoleChange = (userId: string, newRole: any) => {
    const target = usersList.find(u => u.id === userId);
    if (target) {
      target.role = newRole;
      setUsersList([...usersList]);
    }
  };

  const handleResetPassword = (user: Employee) => {
    const res = MockService.resetEmployeePassword(user.id);
    setTempPasswordModal(res.tempPassword);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Foydalanuvchilar va rollar</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Tizimga kirish huquqlari, rollar iyerarxiyasi va hisoblar holati
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foydalanuvchi</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Tizimdagi roli</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead>Oxirgi kirish</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersList.map((u) => (
              <TableRow key={u.id}>
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
                      {u.fullName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                      <div style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{u.branchName}</TableCell>
                <TableCell>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgb(var(--border))',
                      backgroundColor: 'rgb(var(--background))',
                      color: 'rgb(var(--foreground))',
                      fontSize: '12px',
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ADMIN">👑 ADMIN</option>
                    <option value="DIRECTOR">🏢 DIRECTOR</option>
                    <option value="WORKER">📱 WORKER</option>
                  </select>
                </TableCell>
                <TableCell>
                  <span style={{
                    fontSize: '11.5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: u.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: u.status === 'active' ? '#059669' : '#dc2626',
                    fontWeight: 700
                  }}>
                    {u.status === 'active' ? 'Faol' : 'Bloklangan'}
                  </span>
                </TableCell>
                <TableCell style={{ fontSize: '12.5px', color: 'rgb(var(--muted-foreground))' }}>
                  Bugun, 09:40
                </TableCell>
                <TableCell style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPassword(u)}
                      title="Parolni tiklash"
                      style={{ color: '#d97706' }}
                    >
                      <KeyRound size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(u)}
                      title={u.status === 'active' ? 'Bloklash' : 'Faollashtirish'}
                      style={{ color: u.status === 'active' ? 'rgb(var(--destructive))' : '#059669' }}
                    >
                      {u.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Password Reset Modal */}
      <Dialog
        open={!!tempPasswordModal}
        onClose={() => setTempPasswordModal(null)}
        title="Parol muvaffaqiyatli tiklandi"
      >
        <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '13.5px', color: 'rgb(var(--foreground))' }}>
            Yangi vaqtinchalik parol yaratildi:
          </p>
          <div style={{
            padding: '16px',
            backgroundColor: 'rgb(var(--muted))',
            borderRadius: 'var(--radius)',
            fontSize: '22px',
            fontFamily: 'JetBrains Mono',
            fontWeight: 800,
            letterSpacing: '2px',
            color: 'rgb(var(--primary))'
          }}>
            {tempPasswordModal}
          </div>
          <Button onClick={() => {
            if (tempPasswordModal) navigator.clipboard.writeText(tempPasswordModal);
            setTempPasswordModal(null);
          }}>
            Nusxalash va yopish
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
