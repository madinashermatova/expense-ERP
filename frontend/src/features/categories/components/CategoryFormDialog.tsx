import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCategory, useUpdateCategory } from '../api';
import { categorySchema, CategoryFormData, Category } from '../schema';

interface CategoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  categoryToEdit?: Category | null;
  parentId?: string | null;
}

export const CategoryFormDialog = ({ open, onClose, categoryToEdit, parentId }: CategoryFormDialogProps) => {
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  });

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  useEffect(() => {
    if (open) {
      if (categoryToEdit) {
        setValue('nameUz', categoryToEdit.nameUz);
        setValue('nameRu', categoryToEdit.nameRu);
        setValue('parentId', categoryToEdit.parentId || null);
        setValue('receiptRequired', categoryToEdit.receiptRequired);
        setValue('commentRequired', categoryToEdit.commentRequired);
        setValue('maxAmountPerEntry', categoryToEdit.maxAmountPerEntry ? parseFloat(categoryToEdit.maxAmountPerEntry) : null);
      } else {
        reset();
        setValue('parentId', parentId || null);
      }
    }
  }, [open, categoryToEdit, parentId, setValue, reset]);

  const onSubmit = (data: CategoryFormData) => {
    if (categoryToEdit) {
      updateMutation.mutate(
        { id: categoryToEdit.id, data },
        {
          onSuccess: () => onClose(),
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onClose(),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      title={categoryToEdit ? "Kategoriyani tahrirlash" : "Yangi kategoriya qo'shish"}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="Nomi (UZ)"
          placeholder="Yo'l haqi"
          error={errors.nameUz?.message}
          {...register('nameUz')}
        />
        <Input
          label="Nomi (RU)"
          placeholder="Проезд"
          error={errors.nameRu?.message}
          {...register('nameRu')}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="receiptRequired" {...register('receiptRequired')} />
          <label htmlFor="receiptRequired">Chek/isbot talab qilinadi</label>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" id="commentRequired" {...register('commentRequired')} />
          <label htmlFor="commentRequired">Izoh talab qilinadi</label>
        </div>

        <Input
          label="Bitta xarajat uchun maksimal summa (ixtiyoriy)"
          type="number"
          placeholder="Masalan: 500000"
          error={errors.maxAmountPerEntry?.message}
          {...register('maxAmountPerEntry', { setValueAs: v => v === "" ? null : parseFloat(v) })}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
