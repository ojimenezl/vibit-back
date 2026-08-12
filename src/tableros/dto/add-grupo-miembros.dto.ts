import { ArrayMinSize, IsArray, IsMongoId } from 'class-validator';

export class AddGrupoMiembrosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  contactIds: string[];
}
