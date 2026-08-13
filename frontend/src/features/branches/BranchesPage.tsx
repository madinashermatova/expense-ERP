import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import {
  Building2,
  Plus,
  Users,
  AlertTriangle,
  Archive,
  RotateCcw,
  Edit2,
  MapPin,
  Phone,
  Search,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBranches, useArchiveBranch, useRestoreBranch } from './api';
import { Branch } from './schema';
import { BranchFormDialog } from './components/BranchFormDialog';

export const BranchesPage = () => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  // Confirmation dialog state for archive & restore
  const [confirmModal, setConfirmModal] = useState<{
    type: 'archive' | 'restore';
    branch: Branch;
  } | null>(null);

  // Real backend query with filters
  const { data: paginatedData, isLoading, isFetching, refetch } = useBranches({
    status: statusFilter,
    q: searchQuery.trim() || undefined,
    limit: 100
  });

  const archiveMutation = useArchiveBranch();
  const restoreMutation = useRestoreBranch();

  const branches = paginatedData?.items || [];

  const handleOpenCreate = () => {
    setEditingBranch(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'archive') {
      archiveMutation.mutate(confirmModal.branch.id, {
        onSettled: () => setConfirmModal(null)
      });
    } else {
      restoreMutation.mutate(confirmModal.branch.id, {
        onSettled: () => setConfirmModal(null)
      });
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Mavjud emas';
    try {
      return new Date(dateStr).toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isActionPending = archiveMutation.isPending || restoreMutation.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Filiallar boshqaruvi</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Kompaniyaning hududiy filiallari, rahbarlar va faoliyat nazorati
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Yangilash"
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Yangilash
          </Button>

          <Button style={{ gap: '6px' }} onClick={handleOpenCreate}>
            <Plus size={16} /> Yangi filial qo'shish
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid rgb(var(--border))',
        paddingBottom: '8px'
      }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setStatusFilter('active')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${statusFilter === 'active' ? 'rgb(var(--primary))' : 'transparent'}`,
              color: statusFilter === 'active' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Faol filiallar
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${statusFilter === 'archived' ? 'rgb(var(--primary))' : 'transparent'}`,
              color: statusFilter === 'archived' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Arxivlangan
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${statusFilter === 'all' ? 'rgb(var(--primary))' : 'transparent'}`,
              color: statusFilter === 'all' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Barchasi
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--muted-foreground))' }} />
          <Input
            placeholder="Kod yoki nom bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
          Filiallar ro'yxati yuklanmoqda...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && branches.length === 0 && (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: 'rgb(var(--card))',
          borderRadius: 'var(--radius)',
          border: '1px dashed rgb(var(--border))'
        }}>
          <Building2 size={48} style={{ margin: '0 auto 16px', color: 'rgb(var(--muted-foreground))', opacity: 0.6 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Hech qanday filial topilmadi</h3>
          <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))', maxWidth: '380px', margin: '0 auto 16px' }}>
            {searchQuery
              ? `"${searchQuery}" so'rovi bo'yicha mos filial mavjud emas.`
              : statusFilter === 'archived'
              ? 'Hozircha arxivlangan filiallar yo\'q.'
              : 'Hozircha faol filiallar kiritilmagan. Yangi filial qo\'shishingiz mumkin.'}
          </p>
          {statusFilter === 'active' && !searchQuery && (
            <Button onClick={handleOpenCreate} style={{ gap: '6px' }}>
              <Plus size={16} /> Filial qo'shish
            </Button>
          )}
        </div>
      )}

      {/* Branch Cards Grid */}
      {!isLoading && branches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '18px' }}>
          {branches.map((branch) => {
            const isArchived = branch.status === 'ARCHIVED';
            const isNoDirector = (branch.hasNoDirector || branch.directorCount === 0) && !isArchived;

            return (
              <div
                key={branch.id}
                style={{
                  backgroundColor: 'rgb(var(--card))',
                  border: `1px solid ${isArchived ? 'rgba(156, 163, 175, 0.4)' : 'rgb(var(--card-border))'}`,
                  borderRadius: 'var(--radius)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: 'var(--shadow-sm)',
                  opacity: isArchived ? 0.8 : 1,
                  position: 'relative'
                }}
              >
                {/* Top info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: isArchived ? 'rgba(156, 163, 175, 0.15)' : 'rgb(var(--primary-subtle))',
                      color: isArchived ? '#6b7280' : 'rgb(var(--primary))',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{branch.name}</h3>
                        {isArchived && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(156, 163, 175, 0.2)',
                            color: '#6b7280'
                          }}>
                            Arxiv
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>
                        Ochilgan: {formatDate(branch.openedAt)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {!isArchived ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(branch)}
                          title="Tahrirlash"
                        >
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmModal({ type: 'archive', branch })}
                          disabled={archiveMutation.isPending}
                          title="Arxivlash"
                          style={{ color: 'rgb(var(--destructive))' }}
                        >
                          <Archive size={15} />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmModal({ type: 'restore', branch })}
                        disabled={restoreMutation.isPending}
                        title="Qayta tiklash"
                        style={{ gap: '4px', fontSize: '12px', color: '#059669', borderColor: 'rgba(5, 150, 105, 0.3)' }}
                      >
                        <RotateCcw size={13} />
                        Qayta tiklash
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
                    <span>Rahbar: <strong>{branch.directorCount > 0 ? (branch.directorName || 'Tayinlangan') : 'Yo\'q'}</strong></span>
                  </div>
                </div>

                {branch.address && (
                  <div style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.address}</span>
                  </div>
                )}

                {branch.phone && (
                  <div style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} style={{ flexShrink: 0 }} />
                    <span>{branch.phone}</span>
                  </div>
                )}

                {/* Link to expenses */}
                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgb(var(--border))' }}>
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
                    Filial xarajatlarini ko'rish →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <BranchFormDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        branchToEdit={editingBranch}
      />

      {/* Confirmation Modal for Archive & Restore */}
      <Dialog
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.type === 'archive' ? 'Filialni arxivlash' : 'Filialni qayta tiklash'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: confirmModal?.type === 'archive' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(5, 150, 105, 0.12)',
              color: confirmModal?.type === 'archive' ? '#dc2626' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {confirmModal?.type === 'archive' ? <AlertCircle size={22} /> : <RotateCcw size={22} />}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>
                {confirmModal?.type === 'archive'
                  ? `"${confirmModal?.branch.name}" (${confirmModal?.branch.code}) filialini arxivlamoqchimisiz?`
                  : `"${confirmModal?.branch.name}" (${confirmModal?.branch.code}) filialini faol holatga qayta tiklamoqchimisiz?`}
              </p>
              <span style={{ fontSize: '12.5px', color: 'rgb(var(--muted-foreground))' }}>
                {confirmModal?.type === 'archive'
                  ? 'Arxivlangan filiallar yangi xarajatlar kiritish uchun yopiq bo\'ladi.'
                  : 'Filial faol filiallar reestri va hisobotlarga qaytariladi.'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmModal(null)}
              disabled={isActionPending}
            >
              Bekor qilish
            </Button>
            <Button
              variant={confirmModal?.type === 'archive' ? 'destructive' : 'primary'}
              onClick={handleConfirmAction}
              disabled={isActionPending}
            >
              {isActionPending
                ? 'Bajarilmoqda...'
                : confirmModal?.type === 'archive'
                ? 'Ha, arxivlash'
                : 'Ha, qayta tiklash'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
