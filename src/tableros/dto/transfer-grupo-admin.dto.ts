import { IsMongoId } from 'class-validator';

export class TransferGrupoAdminDto {
  @IsMongoId()
  memberId: string;
}
