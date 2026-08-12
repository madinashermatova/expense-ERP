import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import {
  Building2,
  Plus,
  Users,
  AlertTriangle,
  Archive,
  Edit2,
  MapPin
} from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { Branch } from '@/mocks/data';
import { Link } from 'react-router-dom';

export const BranchesPage = () => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>(MockService.getBranches('all'));

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const refreshList = () => {
    setBranches(MockService.getBranches('all'));
  };

  const filteredBranches = statusFilter === 'all'
    ? branches
    : branches.filter(b => b.status === statusFilter);

  const handleOpenCreate = () => {
    setCode('');
    setName('');
    setAddress('');
    setPhone('');
    setCodeError(null);
    setEditingBranch(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setCode(branch.code);
    setName(branch.name);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setCodeError(null);
    setIsCreateOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Regex check on create: ^[A-Z]{2,5}$
    if (!editingBranch) {
      const regex = /^[A-Z]{2,5}$/;
      if (!regex.test(code.toUpperCase())) {
        setCodeError("Filial kodi 2 dan 5 tagacha bosh lotin harflaridan iborat bo'lishi shart (masalan: CHL, SAM, YUN)");
        return;
      }
    }

    if (!name.trim()) {
      alert("Filial nomini kiriting");
      return;
    }

    if (editingBranch) {
      MockService.updateBranch(editingBranch.id, { name, address, phone });
    } else {
      MockService.createBranch({ code: code.toUpperCase(), name, address, phone });
    }

    setIsCreateOpen(false);
    refreshList();
  };

  const handleArchive = (branch: Branch) => {
    if (window.confirm(`"${branch.name}" filialini arxivlamoqchimisiz?`)) {
      MockService.archiveBranch(branch.id);
      refreshList();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Filiallar boshqaruvi</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Kompaniyaning hududiy filiallari, rahbarlar va byudjet nazorati
          </span>
        </div>

        <Button style={{ gap: '6px' }} onClick={handleOpenCreate}>
          <Plus size={16} /> Yangi filial qo'shish
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgb(var(--border))' }}>
        <button
          onClick={() => setStatusFilter('active')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${statusFilter === 'active' ? 'rgb(var(--primary))' : 'transparent'}`,
            color: statusFilter === 'active' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          Faol filiallar ({branches.filter(b => b.status === 'active').length})
        </button>
        <button
          onClick={() => setStatusFilter('archived')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${statusFilter === 'archived' ? 'rgb(var(--primary))' : 'transparent'}`,
            color: statusFilter === 'archived' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          Arxivlangan ({branches.filter(b => b.status === 'archived').length})
        </button>
      </div>

      {/* Branch Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '18px' }}>
        {filteredBranches.map((branch) => {
          const budgetPercent = branch.monthlyLimit > 0 ? Math.round((branch.monthlySpend / branch.monthlyLimit) * 100) : 0;
          const isNoDirector = !branch.directorId && branch.status === 'active';

          return (
            <div
              key={branch.id}
              style={{
                backgroundColor: 'rgb(var(--card))',
                border: '1px solid rgb(var(--card-border))',
                borderRadius: 'var(--radius)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: 'var(--shadow-sm)',
                position: 'relative'
              }}
            >
              {/* Top info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgb(var(--primary-subtle))',
                    color: 'rgb(var(--primary))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    fontFamily: 'JetBrains Mono'
                  }}>
                    {branch.code}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{branch.name}</h3>
                    <span style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>
                      Ochilgan: {branch.openedAt}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(branch)} title="Tahrirlash">
                    <Edit2 size={15} />
                  </Button>
                  {branch.status === 'active' && (
                    <Button variant="ghost" size="sm" onClick={() => handleArchive(branch)} title="Arxivlash" style={{ color: 'rgb(var(--destructive))' }}>
                      <Archive size={15} />
                    </Button>
                  )}
                </div>
              </div>

              {/* Warning if no director assigned */}
              {isNoDirector && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgb(var(--warning-subtle))',
                  color: 'rgb(var(--warning-foreground))',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>Direktori tayinlanmagan!</span>
                </div>
              )}

              {/* Branch Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="rgb(var(--muted-foreground))" />
                  <span><strong>{branch.employeeCount}</strong> xodim</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} color="rgb(var(--muted-foreground))" />
                  <span>Rahbar: <strong>{branch.directorName || 'Yo\'q'}</strong></span>
                </div>
              </div>

              {branch.address && (
                <div style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.address}</span>
                </div>
              )}

              {/* Monthly Spend & Budget Progress */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid rgb(var(--border))', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 600 }}>
                  <span>Joriy oy sarfi:</span>
                  <span style={{ fontFamily: 'JetBrains Mono', color: 'rgb(var(--primary))' }}>
                    {new Intl.NumberFormat('uz-UZ').format(branch.monthlySpend)} UZS
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, budgetPercent)}%`,
                    height: '100%',
                    backgroundColor: budgetPercent > 100 ? 'rgb(var(--destructive))' : budgetPercent > 80 ? '#f59e0b' : 'rgb(var(--success))'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>
                  <span>Limit: {new Intl.NumberFormat('uz-UZ').format(branch.monthlyLimit)} UZS</span>
                  <span style={{ fontWeight: 700 }}>{budgetPercent}%</span>
                </div>
              </div>

              {/* Link to expenses */}
              <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
                <Link
                  to={`/expenses?branchId=${branch.id}`}
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: 'rgb(var(--primary))',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Xarajatlarini ko'rish →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={editingBranch ? "Filial ma'lumotlarini tahrirlash" : "Yangi filial qo'shish"}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Filial kodi (Faqat 2-5 ta bosh harf, o'zgartirib bo'lmaydi)"
            placeholder="CHL"
            value={code}
            disabled={!!editingBranch}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={codeError || undefined}
            required
          />

          <Input
            label="Filial nomi"
            placeholder="Chilonzor filiali"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Manzil"
            placeholder="Toshkent sh., Bunyodkor ko'chasi 15-uy"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Input
            label="Telefon raqami"
            placeholder="+998712001122"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit">
              Saqlash
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
