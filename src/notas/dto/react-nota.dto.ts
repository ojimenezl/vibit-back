import { IsIn, IsString } from 'class-validator';

export const REACTION_TYPES = ['like', 'heart', 'laugh', 'wow'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export class ReactNotaDto {
  @IsString()
  @IsIn(REACTION_TYPES)
  type!: ReactionType;
}
