import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateNotaDto {
  @IsIn(['text', 'draw', 'photo'])
  type!: 'text' | 'draw' | 'photo';

  @ValidateIf((o: CreateNotaDto) => o.type === 'text')
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text?: string;

  /** Data URL JPEG/PNG del dibujo (MVP sin storage externo). */
  @ValidateIf((o: CreateNotaDto) => o.type === 'draw')
  @IsString()
  @MinLength(32)
  @MaxLength(2_500_000)
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  imageDataUrl?: string;

  /** Solo tableros efímeros: a quién se envía la nota (ids de miembros). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  recipientIds?: string[];
}
