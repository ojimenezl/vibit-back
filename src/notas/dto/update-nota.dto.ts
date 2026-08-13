import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateNotaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(2_500_000)
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  imageDataUrl?: string;
}
