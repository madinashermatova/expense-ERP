import { IsUUID } from 'class-validator';

export class TransferEmployeeDto {
  @IsUUID()
  toBranchId!: string;
}
