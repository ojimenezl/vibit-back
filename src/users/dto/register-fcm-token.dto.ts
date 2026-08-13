import { IsString, MinLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @MinLength(10)
  token: string;
}
