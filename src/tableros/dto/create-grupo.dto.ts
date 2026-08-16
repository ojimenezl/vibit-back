import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateGrupoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  contactIds!: string[];

  @IsOptional()
  @IsIn(['text', 'draw', 'photo'])
  type?: 'text' | 'draw' | 'photo';

  @ValidateIf((o: CreateGrupoDto) => (o.type ?? 'text') === 'text')
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text?: string;

  @ValidateIf((o: CreateGrupoDto) => o.type === 'draw' || o.type === 'photo')
  @IsString()
  @MinLength(32)
  @MaxLength(2_500_000)
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  imageDataUrl?: string;
}
