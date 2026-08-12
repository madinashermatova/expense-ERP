import { Badge } from '@/components/ui/Badge';
import { Circle, Clock, CheckCircle2, XCircle, Ban, Undo2 } from 'lucide-react';

const STATUS_MAP = {
  DRAFT: { label: 'Qoralama', variant: 'neutral', icon: Circle },
  DIRECTOR_PENDING: { label: 'Direktor tasdig\'ida', variant: 'warning', icon: Clock },
  ADMIN_PENDING: { label: 'Yakuniy tasdiqda', variant: 'info', icon: Clock },
  NEEDS_FIX: { label: 'Tuzatish so\'raldi', variant: 'warning', icon: Undo2 },
  APPROVED: { label: 'Tasdiqlangan', variant: 'success', icon: CheckCircle2 },
  REJECTED: { label: 'Rad etilgan', variant: 'destructive', icon: XCircle },
  CANCELLED: { label: 'Bekor qilingan', variant: 'neutral', icon: Ban },
} as const;

type StatusType = keyof typeof STATUS_MAP;

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = STATUS_MAP[status as StatusType] || { label: status, variant: 'neutral', icon: Circle };
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant as any}>
      <Icon size={12} />
      {config.label}
    </Badge>
  );
};
