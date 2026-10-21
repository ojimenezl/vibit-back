import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  username!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'El PIN debe tener exactamente 4 dígitos' })
  pin!: string;

  /** Si viene, se verifica y se vincula Google al crear la cuenta. */
  @IsOptional()
  @IsString()
  @MinLength(20)
  idToken?: string;
}