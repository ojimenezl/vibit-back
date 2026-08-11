import { IsMongoId } from 'class-validator';

export class MarkWidgetSeenDto {
  @IsMongoId()
  boardId: string;
}
