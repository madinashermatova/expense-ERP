import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateBranch, useUpdateBranch } from '../api';
import { branchSchema, BranchFormData, Branch } from '../schema';
import { AlertCircle } from 'lucide-react';

interface BranchFormDialogProps {
  open: boolean;
  onClose: () => void;
  branchToEdit?: Branch | null;
}

export const BranchFormDialog = ({ open, onClose, branchToEdit }: BranchFormDialogProps) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    setError
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
  });

  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();

  useEffect(() => {
    if (open) {
      setServerError(null);
      if (branchToEdit) {
        setValue('code', branchToEdit.code);
        setValue('name', branchToEdit.name);
        setValue('address', branchToEdit.address || '');
        setValue('phone', branchToEdit.phone || '');
        setValue('openedAt', branchToEdit.openedAt ? branchToEdit.openedAt.substring(0, 10) : '');
      } else {
        reset({
          code: '',
          name: '',
          address: '',
          phone: '',
          openedAt: new Date().toISOString().substring(0, 10)
        });
      }
    }
  }, [open, branchToEdit, setValue, reset]);

  const handleFormError = (error: any) => {
    const errData = error?.response?.data;
    if (errData?.details) {
      Object.entries(errData.details).forEach(([key, msgs]) => {
        if (Array.isArray(msgs) && msgs.length > 0) {
          setError(key as any, { message: msgs[0] as string });
        }
      });
    }
    setServerError(errData?.message || "Xatolik yuz berdi");
  };

  const onSubmit = (data: BranchFormData) => {
    setServerError(null);
    if (branchToEdit) {
      const { code: _code, ...updateData } = data;
      const payload: any = {
        name: updateData.name,
        address: updateData.address || undefined,
        phone: updateData.phone || undefined,
        openedAt: updateData.openedAt ? new Date(updateData.openedAt).toISOString() : undefined
      };

      updateMutation.mutate(
        { id: branchToEdit.id, data: payload },
        {
          onSuccess: () => {
            onClose();
          },
          onError: handleFormError
        }
      );
    } else {
      const payload: any = {
        code: data.code.toUpperCase(),
        name: data.name,
        address: data.address || undefined,
        phone: data.phone || undefined,
        openedAt: data.openedAt ? new Date(data.openedAt).toISOString() : undefined
      };

      createMutation.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
        onError: handleFormError
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      title={branchToEdit ? "Filial ma'lumotlarini tahrirlash" : "Yangi filial qo'shish"}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {serverError && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{serverError}</span>
          </div>
        )}

        <Input
          label="Filial kodi (2-5 ta bosh lotin harfi, masalan: CHL, YUN, MRZ)"
          placeholder="CHL"
          error={errors.code?.message}
          disabled={!!branchToEdit}
          {...register('code', {
            onChange: (e) => {
              setValue('code', e.target.value.toUpperCase());
            }
          })}
        />

        <Input
          label="Filial nomi *"
          placeholder="Chilonzor filiali"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Manzil"
          placeholder="Toshkent sh., Bunyodkor ko'chasi 15-uy"
          error={errors.address?.message}
          {...register('address')}
        />

        <Input
          label="Telefon raqami"
          placeholder="+998712001122"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Ochilgan sana"
          type="date"
          error={errors.openedAt?.message}
          {...register('openedAt')}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
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
