import { ArrayMinSize, IsArray, IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class ShareDirectaDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  contactIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
