import React, { useState } from 'react';
import { useCategories } from './api';
import { Category } from './schema';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CategoryFormDialog } from './components/CategoryFormDialog';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const CategoriesPage = () => {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const { data: categories, isLoading, refetch } = useCategories(statusFilter);
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/categories/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Kategoriya arxivlandi');
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        toast.error('Kategoriya ishlatilgan, o\'chirib bo\'lmaydi');
      }
    }
  });

  const handleCreateRoot = () => {
    setCategoryToEdit(null);
    setParentIdForNew(null);
    setIsFormOpen(true);
  };

  const handleCreateChild = (parentId: string) => {
    setCategoryToEdit(null);
    setParentIdForNew(parentId);
    setIsFormOpen(true);
  };

  const handleEdit = (category: Category) => {
    setCategoryToEdit(category);
    setParentIdForNew(category.parentId);
    setIsFormOpen(true);
  };

  const renderCategory = (category: Category, isChild = false) => {
    return (
      <div key={category.id} style={{ 
        marginLeft: isChild ? '2rem' : '0', 
        padding: '0.5rem', 
        border: '1px solid rgb(var(--border))',
        marginBottom: '0.5rem',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: isChild ? 'normal' : 'bold' }}>{category.nameUz} / {category.nameRu}</span>
            {category.receiptRequired && <Badge variant="secondary" style={{ marginLeft: '0.5rem' }}>Chek kerak</Badge>}
            {category.status === 'ARCHIVED' && <Badge variant="destructive" style={{ marginLeft: '0.5rem' }}>Arxivlangan</Badge>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>Tahrirlash</Button>
            {!isChild && category.status === 'ACTIVE' && (
              <Button variant="ghost" size="sm" onClick={() => handleCreateChild(category.id)}>+ Qism kategoriya</Button>
            )}
            {category.status === 'ACTIVE' && (
              <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(category.id)}>Arxivlash</Button>
            )}
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            {category.children.map(child => renderCategory(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Kategoriyalar</h1>
        <Button onClick={handleCreateRoot}>+ Bosh kategoriya</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <select 
          value={statusFilter} 
          onChange={e => setStatusFilter(e.target.value as any)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgb(var(--border))' }}
        >
          <option value="active">Faol</option>
          <option value="archived">Arxivlangan</option>
          <option value="all">Barchasi</option>
        </select>
      </div>

      {isLoading ? (
        <p>Yuklanmoqda...</p>
      ) : (
        <div>
          {categories?.length === 0 ? (
            <p>Kategoriyalar topilmadi.</p>
          ) : (
            categories?.map(c => renderCategory(c, false))
          )}
        </div>
      )}

      <CategoryFormDialog 
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        categoryToEdit={categoryToEdit}
        parentId={parentIdForNew}
      />
    </div>
  );
};
