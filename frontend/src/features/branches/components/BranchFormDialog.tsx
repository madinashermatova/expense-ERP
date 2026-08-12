import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateBranch, useUpdateBranch } from '../api';
import { branchSchema, BranchFormData, Branch } from '../schema';

interface BranchFormDialogProps {
  open: boolean;
  onClose: () => void;
  branchToEdit?: Branch | null;
}

export const BranchFormDialog = ({ open, onClose, branchToEdit }: BranchFormDialogProps) => {
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
  });

  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();

  useEffect(() => {
    if (open) {
      if (branchToEdit) {
        setValue('code', branchToEdit.code);
        setValue('name', branchToEdit.name);
        setValue('address', branchToEdit.address || '');
        setValue('phone', branchToEdit.phone || '');
        setValue('openedAt', branchToEdit.openedAt ? branchToEdit.openedAt.substring(0, 10) : '');
      } else {
        reset();
      }
    }
  }, [open, branchToEdit, setValue, reset]);

  const onSubmit = (data: BranchFormData) => {
    if (branchToEdit) {
      const { code, ...updateData } = data; // code can't be updated
      updateMutation.mutate(
        { id: branchToEdit.id, data: updateData },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      title={branchToEdit ? "Filialni tahrirlash" : "Yangi filial qo'shish"}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="Filial kodi"
          placeholder="masalan: TAS"
          error={errors.code?.message}
          disabled={!!branchToEdit} // Yaratishda faqat
          {...register('code')}
        />
        <Input
          label="Nomi"
          placeholder="Toshkent filial"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Manzil"
          placeholder="Toshkent sh..."
          error={errors.address?.message}
          {...register('address')}
        />
        <Input
          label="Telefon"
          placeholder="+998901234567"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Input
          label="Ochilgan sana"
          type="date"
          error={errors.openedAt?.message}
          {...register('openedAt')}
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
