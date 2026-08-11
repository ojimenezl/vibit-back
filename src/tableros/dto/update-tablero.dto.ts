import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTableroDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;
}
