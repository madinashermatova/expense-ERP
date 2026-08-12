import { useState } from 'react';
import { useBranches, useArchiveBranch } from './api';
import { Branch } from './schema';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BranchFormDialog } from './components/BranchFormDialog';
import { Dialog } from '@/components/ui/Dialog';

export const BranchesPage = () => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('all');
  const { data: branches, isLoading, isError, refetch } = useBranches(statusFilter);
  const archiveMutation = useArchiveBranch();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);

  const [branchToArchive, setBranchToArchive] = useState<Branch | null>(null);

  const handleCreate = () => {
    setBranchToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setBranchToEdit(branch);
    setIsFormOpen(true);
  };

  const handleArchiveConfirm = () => {
    if (branchToArchive) {
      archiveMutation.mutate(branchToArchive.id, {
        onSuccess: () => {
          setBranchToArchive(null);
        },
      });
    }
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Filiallar</h1>
        <Button onClick={handleCreate}>+ Yangi filial</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value as any)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgb(var(--border))' }}
        >
          <option value="all">Barchasi</option>
          <option value="active">Faol</option>
          <option value="archived">Arxivlangan</option>
        </select>
      </div>

      {isLoading && <p>Yuklanmoqda...</p>}
      {isError && (
        <div style={{ color: 'red' }}>
          Xatolik yuz berdi. <Button variant="ghost" onClick={() => refetch()}>Qayta urinish</Button>
        </div>
      )}

      {branches && branches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed rgb(var(--border))' }}>
          <p>Filiallar topilmadi</p>
          <Button onClick={handleCreate} style={{ marginTop: '1rem' }}>Filial qo'shish</Button>
        </div>
      )}

      {branches && branches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Nomi</TableHead>
              <TableHead>Holati</TableHead>
              <TableHead>Xodimlar soni</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map(branch => (
              <TableRow key={branch.id}>
                <TableCell>{branch.code}</TableCell>
                <TableCell>{branch.name}</TableCell>
                <TableCell>
                  <Badge variant={branch.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {branch.status === 'ACTIVE' ? 'Faol' : 'Arxivlangan'}
                  </Badge>
                </TableCell>
                <TableCell>{branch._count?.employees || 0}</TableCell>
                <TableCell style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" onClick={() => handleEdit(branch)}>Tahrirlash</Button>
                  {branch.status === 'ACTIVE' && (
                    <Button variant="ghost" onClick={() => setBranchToArchive(branch)}>Arxivlash</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <BranchFormDialog 
        open={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        branchToEdit={branchToEdit} 
      />

      <Dialog open={!!branchToArchive} onClose={() => setBranchToArchive(null)} title="Tasdiqlash">
        <p>Rostdan ham <b>{branchToArchive?.name}</b> filialini arxivlamoqchimisiz?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <Button variant="ghost" onClick={() => setBranchToArchive(null)}>Bekor qilish</Button>
          <Button onClick={handleArchiveConfirm} disabled={archiveMutation.isPending}>
            {archiveMutation.isPending ? 'Arxivlanmoqda...' : 'Arxivlash'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
