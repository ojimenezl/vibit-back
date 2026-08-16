import { Injectable } from '@nestjs/common';
import { TablerosService } from '../tableros/tableros.service';
import { NotasRepository } from '../notas/notas.repository';
import { UsersService } from '../users/users.service';

@Injectable()
export class WidgetService {
  constructor(
    private readonly tablerosService: TablerosService,
    private readonly notasRepository: NotasRepository,
    private readonly usersService: UsersService,
  ) {}

  async getFeed(userId: string) {
    const user = await this.usersService.findById(userId);
    const seenMap = new Map(
      (user?.widgetSeen ?? []).map((s) => [s.boardId.toString(), new Date(s.lastSeenAt)]),
    );

    const boards = await this.tablerosService.listActiveBoardsForUser(userId);
    const personal = boards.find((b) => b.categoria === 'personal');
    const shared = boards
      .filter((b) => b.categoria !== 'personal')
      .sort((a, b) => {
        const aTime = (a as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
        const bTime = (b as { updatedAt?: Date }).updatedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    const allMemberIds = [
      ...new Set(boards.flatMap((b) => b.miembros.map((id) => id.toString()))),
    ];
    const members = await this.usersService.findByIds(allMemberIds);
    const usernameMap = new Map(members.map((m) => [m._id.toString(), m.username]));

    const pages: Array<{
      id: string;
      boardId: string;
      boardName: string;
      boardCategoria: string;
      type: 'text' | 'draw' | 'photo';
      text: string;
      imageDataUrl: string | null;
      authorUsername: string;
      authorId: string;
      isPersonal: boolean;
      isUnseen: boolean;
      reactionCounts: { like: number; heart: number; laugh: number; wow: number };
      myReaction: string | null;
      createdAt?: Date;
    }> = [];

    let hasUnseen = false;

    const pushBoardNotes = async (
      board: (typeof boards)[number],
      ascending: boolean,
    ) => {
      const notas = ascending
        ? await this.notasRepository.findActiveByBoardAsc(board._id.toString())
        : await this.notasRepository.findActiveByBoard(board._id.toString());

      const isPersonal = board.categoria === 'personal';
      const miembrosInfo = board.miembros.map((id) => ({
        id: id.toString(),
        username: usernameMap.get(id.toString()) ?? 'Usuario',
      }));
      const displayName = this.tablerosService.displayNameForUser(
        board,
        userId,
        miembrosInfo,
      );

      const lastSeen = seenMap.get(board._id.toString());

      for (const nota of notas) {
        if (
          !NotasRepository.isVisibleToUser(nota, userId, board.categoria)
        ) {
          continue;
        }

        const publicNota = this.notasRepository.toPublic(
          nota,
          userId,
          board.categoria,
        );
        let text = '';
        let imageDataUrl: string | null = null;
        let type: 'text' | 'draw' | 'photo' = 'text';

        if (nota.type === 'draw' || nota.type === 'photo') {
          const mediaUrl =
            Array.isArray(publicNota.media) && publicNota.media[0]?.url
              ? String(publicNota.media[0].url)
              : '';
          if (!mediaUrl) continue;
          type = nota.type;
          text = nota.type === 'photo' ? '◉ Foto' : '✎ Dibujo';
          imageDataUrl = mediaUrl;
        } else if (nota.type === 'text' && nota.text) {
          type = 'text';
          text = nota.text;
        } else {
          continue;
        }

        const createdAt = (nota as { createdAt?: Date }).createdAt;
        const isUnseen =
          !isPersonal &&
          (!lastSeen || (createdAt ? createdAt.getTime() > lastSeen.getTime() : true));
        if (isUnseen) hasUnseen = true;

        pages.push({
          id: nota._id.toString(),
          boardId: board._id.toString(),
          boardName: displayName,
          boardCategoria: board.categoria,
          type,
          text,
          imageDataUrl,
          authorUsername: usernameMap.get(nota.authorId.toString()) ?? 'Usuario',
          authorId: nota.authorId.toString(),
          isPersonal,
          isUnseen,
          reactionCounts: publicNota.reactionCounts,
          myReaction: publicNota.myReaction,
          createdAt,
        });
      }
    };

    if (personal) await pushBoardNotes(personal, false);
    for (const board of shared) await pushBoardNotes(board, true);

    return { hasUnseen, pages };
  }

  async markSeen(userId: string, boardId: string) {
    await this.tablerosService.getByIdForMember(boardId, userId);
    await this.usersService.markWidgetBoardSeen(userId, boardId);
    return { ok: true };
  }
}
