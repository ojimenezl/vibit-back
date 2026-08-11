import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateNotaDto {
  @IsIn(['text', 'draw', 'photo'])
  type!: 'text' | 'draw' | 'photo';

  @ValidateIf((o: CreateNotaDto) => o.type === 'text')
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text?: string;
}
