import React, { useState } from 'react';
import { useEmployees, useResetEmployeePassword } from './api';
import { Employee } from './schema';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmployeeFormDialog } from './components/EmployeeFormDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export const EmployeesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const { data, isLoading } = useEmployees({
    q: searchTerm,
    branchId: branchFilter,
    status: statusFilter,
    page: 1,
    limit: 50, // pagination could be added later
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const resetPasswordMutation = useResetEmployeePassword();
  const [employeeToReset, setEmployeeToReset] = useState<Employee | null>(null);

  const handleCreate = () => {
    setEmployeeToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (emp: Employee) => {
    setEmployeeToEdit(emp);
    setIsFormOpen(true);
  };

  const handleCreateSuccess = (pw: string) => {
    setTempPassword(pw);
  };

  const confirmResetPassword = () => {
    if (employeeToReset) {
      resetPasswordMutation.mutate(employeeToReset.id, {
        onSuccess: (res) => {
          setTempPassword(res.tempPassword);
          setEmployeeToReset(null);
          toast.success("Parol muvaffaqiyatli tiklandi");
        }
      });
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Xodimlar</h1>
        <Button onClick={handleCreate}>+ Yangi xodim</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Input 
          placeholder="Ism yoki email orqali qidirish..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        {/* Filial va Status filtrlari ham qo'shilishi mumkin */}
      </div>

      {isLoading && <p>Yuklanmoqda...</p>}

      {data?.items && data.items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed rgb(var(--border))' }}>
          <p>Xodimlar topilmadi</p>
        </div>
      )}

      {data?.items && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>F.I.Sh.</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map(emp => (
              <TableRow key={emp.id}>
                <TableCell>{emp.fullName}</TableCell>
                <TableCell>{emp.email}</TableCell>
                <TableCell>{emp.role}</TableCell>
                <TableCell>
                  <Badge variant={emp.isActive ? 'default' : 'secondary'}>
                    {emp.isActive ? 'Faol' : 'Nofaol'}
                  </Badge>
                  {emp.botBlocked && (
                    <Badge variant="destructive" style={{ marginLeft: '4px' }}>Bot bloklangan</Badge>
                  )}
                </TableCell>
                <TableCell style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(emp)}>Tahrirlash</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEmployeeToReset(emp)}>Parolni tiklash</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EmployeeFormDialog 
        open={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        employeeToEdit={employeeToEdit}
        onSuccessCreate={handleCreateSuccess}
      />

      <Dialog open={!!tempPassword} onClose={() => setTempPassword(null)} title="Boshlang'ich parol">
        <div style={{ padding: '1rem 0' }}>
          <p style={{ marginBottom: '1rem', color: 'red' }}>Diqqat! Bu parol qayta ko'rsatilmaydi. Uni saqlab oling.</p>
          <div style={{ padding: '1rem', background: '#f4f4f5', borderRadius: '8px', fontSize: '1.25rem', textAlign: 'center', letterSpacing: '2px', fontFamily: 'monospace' }}>
            {tempPassword}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={() => setTempPassword(null)}>Tushunarli</Button>
        </div>
      </Dialog>

      <Dialog open={!!employeeToReset} onClose={() => setEmployeeToReset(null)} title="Parolni tiklash">
        <p>Rostdan ham <b>{employeeToReset?.fullName}</b> xodimining parolini tiklamoqchimisiz?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <Button variant="ghost" onClick={() => setEmployeeToReset(null)}>Bekor qilish</Button>
          <Button onClick={confirmResetPassword} disabled={resetPasswordMutation.isPending}>
            {resetPasswordMutation.isPending ? 'Tiklanmoqda...' : 'Tiklash'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
