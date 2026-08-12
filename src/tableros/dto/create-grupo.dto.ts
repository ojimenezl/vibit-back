import { ArrayMinSize, IsArray, IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGrupoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  contactIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
