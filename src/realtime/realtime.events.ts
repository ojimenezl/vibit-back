export const REALTIME_EVENTS = {
  BOARD_CREATED: 'board:created',
  BOARD_REMOVED: 'board:removed',
  NOTE_CREATED: 'note:created',
  NOTIFICATION_NEW: 'notification:new',
  REACTION_UPDATED: 'reaction:updated',
} as const;

export type BoardCreatedPayload = {
  boardId: string;
};

export type BoardRemovedPayload = {
  boardId: string;
};

export type NoteCreatedPayload = {
  boardId: string;
  authorId: string;
  nota: unknown;
};

export type ReactionCounts = {
  like: number;
  heart: number;
  laugh: number;
  wow: number;
};

export type ReactionUpdatedPayload = {
  boardId: string;
  notaId: string;
  userId: string;
  reaction: string | null;
  reactionCounts: ReactionCounts;
};
