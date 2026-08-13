import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import {
  REALTIME_EVENTS,
  type BoardCreatedPayload,
  type BoardRemovedPayload,
  type NoteCreatedPayload,
  type ReactionCounts,
  type ReactionUpdatedPayload,
} from './realtime.events';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitBoardCreated(memberIds: string[], boardId: string, excludeUserId?: string) {
    const payload: BoardCreatedPayload = { boardId };
    this.emitToUsers(memberIds, REALTIME_EVENTS.BOARD_CREATED, payload, excludeUserId);
  }

  emitBoardRemoved(memberIds: string[], boardId: string, excludeUserId?: string) {
    const payload: BoardRemovedPayload = { boardId };
    this.emitToUsers(memberIds, REALTIME_EVENTS.BOARD_REMOVED, payload, excludeUserId);
  }

  emitNoteCreated(
    memberIds: string[],
    boardId: string,
    nota: unknown,
    authorId: string,
  ) {
    const payload: NoteCreatedPayload = { boardId, authorId, nota };
    this.emitToUsers(memberIds, REALTIME_EVENTS.NOTE_CREATED, payload, authorId);
  }

  emitNotificationNew(userId: string) {
    this.gateway.emitToUser(userId, REALTIME_EVENTS.NOTIFICATION_NEW, {});
  }

  emitReactionUpdated(
    memberIds: string[],
    boardId: string,
    notaId: string,
    userId: string,
    reaction: string | null,
    reactionCounts: ReactionCounts,
  ) {
    const payload: ReactionUpdatedPayload = {
      boardId,
      notaId,
      userId,
      reaction,
      reactionCounts,
    };
    this.emitToUsers(memberIds, REALTIME_EVENTS.REACTION_UPDATED, payload, userId);
  }

  private emitToUsers(
    userIds: string[],
    event: string,
    payload: unknown,
    excludeUserId?: string,
  ) {
    const unique = [...new Set(userIds)].filter(
      (id) => id && id !== excludeUserId,
    );
    for (const userId of unique) {
      this.gateway.emitToUser(userId, event, payload);
    }
  }
}
