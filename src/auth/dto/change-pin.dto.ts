import { IsString, Matches } from 'class-validator';

export class ChangePinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'El PIN actual debe tener exactamente 4 dígitos' })
  currentPin!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'El nuevo PIN debe tener exactamente 4 dígitos' })
  newPin!: string;
}
