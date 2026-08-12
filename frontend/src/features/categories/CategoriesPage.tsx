import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  FileText,
  MessageSquare,
  Scale,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Folder
} from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { Category } from '@/mocks/data';

export const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>(MockService.getCategories());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inUseErrorModal, setInUseErrorModal] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ c1: true, c2: true, c3: true, c4: true, c5: true });

  // Form State
  const [parentId, setParentId] = useState<string>('');
  const [nameUz, setNameUz] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [receiptRequired, setReceiptRequired] = useState(true);
  const [commentRequired, setCommentRequired] = useState(false);
  const [maxAmount, setMaxAmount] = useState('10000000');

  const toggleExpand = (id: string) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = (parent?: string) => {
    setParentId(parent || '');
    setNameUz('');
    setNameRu('');
    setReceiptRequired(true);
    setCommentRequired(false);
    setMaxAmount('10000000');
    setIsCreateOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim()) {
      alert("Iltimos kategoriya nomini kiriting");
      return;
    }

    MockService.createCategory({
      parentId: parentId || undefined,
      nameUz,
      nameRu: nameRu || nameUz,
      receiptRequired,
      commentRequired,
      maxAmountPerEntry: parseFloat(maxAmount) || undefined
    });

    setCategories(MockService.getCategories());
    setIsCreateOpen(false);
  };

  const handleDeleteAttempt = (cat: Category) => {
    // 409 In-Use Prevention Dialog (TZ Section 6.10)
    setInUseErrorModal(`"${cat.nameUz}" kategoriyasida hozirda faol arizalar va sarf-xarajatlar tarixi mavjud. Uni o'chirib bo'lmaydi. Faqat arxivlash yoki limitlarini o'zgartirish mumkin.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Kategoriyalar daraxti</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            2-darajali xarajatlar iyerarxiyasi, limitlar va chek talablari
          </span>
        </div>

        <Button style={{ gap: '6px' }} onClick={() => handleOpenCreate()}>
          <Plus size={16} /> Yangi asosiy kategoriya
        </Button>
      </div>

      {/* Category Tree Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {categories.map((parent) => {
          const isExpanded = expandedCats[parent.id];
          return (
            <div
              key={parent.id}
              style={{
                backgroundColor: 'rgb(var(--card))',
                border: '1px solid rgb(var(--card-border))',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden'
              }}
            >
              {/* Parent Category Header */}
              <div
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(var(--muted), 0.4)',
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid rgb(var(--border))' : 'none'
                }}
                onClick={() => toggleExpand(parent.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <Folder size={20} color="rgb(var(--primary))" />
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgb(var(--foreground))' }}>
                      {parent.nameUz}
                    </span>
                    <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', marginLeft: '8px' }}>
                      ({parent.nameRu})
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {parent.receiptRequired && (
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgb(var(--primary-subtle))', color: 'rgb(var(--primary))', fontWeight: 600 }}>
                        Chek shart
                      </span>
                    )}
                    {parent.commentRequired && (
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 600 }}>
                        Izoh shart
                      </span>
                    )}
                    {parent.maxAmountPerEntry && (
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: 600 }}>
                        Max: {new Intl.NumberFormat('uz-UZ').format(parent.maxAmountPerEntry)} UZS
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenCreate(parent.id)}
                    style={{ gap: '4px', fontSize: '12px' }}
                  >
                    <Plus size={14} /> Kategoriya qo'shish
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAttempt(parent)}
                    style={{ color: 'rgb(var(--destructive))' }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>

              {/* Subcategories (Level 2) */}
              {isExpanded && parent.children && parent.children.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {parent.children.map((sub, idx) => (
                    <div
                      key={sub.id}
                      style={{
                        padding: '12px 18px 12px 48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: idx < (parent.children?.length || 0) - 1 ? '1px solid rgb(var(--border))' : 'none',
                        fontSize: '13.5px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'rgb(var(--muted-foreground))' }}>↳</span>
                        <span style={{ fontWeight: 600 }}>{sub.nameUz}</span>
                        <span style={{ fontSize: '11.5px', color: 'rgb(var(--muted-foreground))' }}>({sub.nameRu})</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {sub.receiptRequired && (
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgb(var(--primary-subtle))', color: 'rgb(var(--primary))' }}>
                            Chek
                          </span>
                        )}
                        {sub.commentRequired && (
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                            Izoh
                          </span>
                        )}
                        {sub.maxAmountPerEntry && (
                          <span style={{ fontSize: '11.5px', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                            {new Intl.NumberFormat('uz-UZ').format(sub.maxAmountPerEntry)} UZS
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttempt(sub)}
                          style={{ color: 'rgb(var(--destructive))', padding: '4px 8px' }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={parentId ? "Ichki kategoriya yaratish" : "Asosiy kategoriya yaratish"}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {parentId && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgb(var(--muted))', fontSize: '12.5px' }}>
              Yuqori kategoriya: <strong>{categories.find(c => c.id === parentId)?.nameUz}</strong>
            </div>
          )}

          <Input
            label="Kategoriya nomi (O'zbekcha)"
            placeholder="Kantselyariya mollari"
            value={nameUz}
            onChange={(e) => setNameUz(e.target.value)}
            required
          />

          <Input
            label="Kategoriya nomi (Ruscha)"
            placeholder="Канцелярские товары"
            value={nameRu}
            onChange={(e) => setNameRu(e.target.value)}
          />

          <Input
            label="1 martalik maksimal limit (UZS)"
            type="number"
            placeholder="10000000"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={receiptRequired}
                onChange={(e) => setReceiptRequired(e.target.checked)}
              />
              Chek / Isbot fayli majburiy bo'lsin (receiptRequired)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={commentRequired}
                onChange={(e) => setCommentRequired(e.target.checked)}
              />
              Izoh / Sabab yozish majburiy bo'lsin (commentRequired)
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit">
              Kategoriyani saqlash
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 409 In-Use Explanation Dialog (TZ Section 6.10) */}
      <Dialog
        open={!!inUseErrorModal}
        onClose={() => setInUseErrorModal(null)}
        title="O'chirish cheklangan (409 Konflikt)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d97706' }}>
            <AlertTriangle size={32} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgb(var(--foreground))' }}>
              Ushbu kategoriya xarajatlarda ishlatilgan
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))', lineHeight: 1.5 }}>
            {inUseErrorModal}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button onClick={() => setInUseErrorModal(null)}>
              Tushundim
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
