import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TablerosRepository } from './tableros.repository';
import { UsersService } from '../users/users.service';
import { NotasRepository } from '../notas/notas.repository';
import { ShareDirectaDto } from './dto/share-directa.dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { TableroDocument } from './schemas/tablero.schema';
import { RealtimeService } from '../realtime/realtime.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TablerosService {
  constructor(
    private readonly tablerosRepository: TablerosRepository,
    private readonly usersService: UsersService,
    private readonly notasRepository: NotasRepository,
    private readonly realtimeService: RealtimeService,
  ) {}

  async createPersonal(userId: string, username: string) {
    const adminId = new Types.ObjectId(userId);
    return this.tablerosRepository.create({
      nombre: `Personal · ${username}`,
      tipoTablero: 'estatico',
      categoria: 'personal',
      adminUserId: adminId,
      inviteCode: null,
      miembros: [adminId],
      solicitudesEntrada: [],
      expiresAt: null,
    });
  }

  async getPersonal(userId: string) {
    let tablero = await this.tablerosRepository.findPersonalByUser(userId);

    if (!tablero) {
      const user = await this.usersService.findById(userId);
      if (!user) throw new NotFoundException('Usuario no encontrado');
      tablero = await this.createPersonal(userId, user.username);
      await this.usersService.addTablero(userId, tablero._id);
    }

    return this.tablerosRepository.toPublic(tablero);
  }

  async getByIdForMember(boardId: string, userId: string) {
    const tablero = await this.tablerosRepository.findById(boardId);
    if (!tablero) throw new NotFoundException('Tablero no encontrado');

    const isMember = tablero.miembros.some((id) => id.toString() === userId);
    if (!isMember) throw new ForbiddenException('No perteneces a este tablero');

    if (tablero.expiresAt && tablero.expiresAt <= new Date()) {
      throw new NotFoundException('Este tablero ya expiró');
    }

    return tablero;
  }

  async getPublicForMember(boardId: string, userId: string) {
    const tablero = await this.getByIdForMember(boardId, userId);
    const memberUsers = await this.usersService.findByIds(
      tablero.miembros.map((id) => id.toString()),
    );
    const userMap = new Map(
      memberUsers.map((u) => [u._id.toString(), u.username]),
    );
    const miembrosInfo = tablero.miembros.map((id) => ({
      id: id.toString(),
      username: userMap.get(id.toString()) ?? 'Usuario',
    }));

    return {
      ...this.tablerosRepository.toPublic(tablero),
      displayName: this.displayNameForUser(tablero, userId, miembrosInfo),
      miembrosInfo,
    };
  }

  /** Join order: creator first, then members as they were added. */
  private pickOldestRemainingMember(
    miembros: Types.ObjectId[],
    leavingUserId: string,
  ): Types.ObjectId | null {
    const remaining = miembros.filter((id) => id.toString() !== leavingUserId);
    return remaining[0] ?? null;
  }

  /** Public so widget feed uses the same naming rules as Home. */
  displayNameForUser(
    tablero: { categoria: string; nombre: string; adminUserId: Types.ObjectId | string },
    userId: string,
    miembrosInfo: { id: string; username: string }[],
  ) {
    if (tablero.categoria === 'personal') return 'Mi tablero';
    if (tablero.categoria === 'grupo') return tablero.nombre;

    // Efímero: solo el creador ve los nombres de los destinatarios.
    // Los receptores ven el nombre de quien envió la nota.
    const adminId =
      typeof tablero.adminUserId === 'string'
        ? tablero.adminUserId
        : tablero.adminUserId.toString();

    if (userId === adminId) {
      const others = miembrosInfo
        .filter((m) => m.id !== userId)
        .map((m) => m.username);
      if (others.length) return others.join(' · ');
      return tablero.nombre;
    }

    const creator = miembrosInfo.find((m) => m.id === adminId);
    return creator?.username ?? tablero.nombre;
  }

  async listShared(userId: string) {
    const boards = await this.tablerosRepository.findSharedForUser(userId);
    const allMemberIds = [
      ...new Set(boards.flatMap((b) => b.miembros.map((id) => id.toString()))),
    ];
    const users = await this.usersService.findByIds(allMemberIds);
    const nameMap = new Map(users.map((u) => [u._id.toString(), u.username]));

    return boards.map((b) => {
      const miembrosInfo = b.miembros.map((id) => ({
        id: id.toString(),
        username: nameMap.get(id.toString()) ?? 'Usuario',
      }));
      return {
        ...this.tablerosRepository.toPublic(b),
        displayName: this.displayNameForUser(b, userId, miembrosInfo),
        miembrosInfo,
      };
    });
  }

  private async resolveContactMembers(userId: string, contactIds: string[]) {
    const uniqueIds = [...new Set(contactIds.map((id) => id.trim()))].filter(
      (id) => id !== userId,
    );
    if (!uniqueIds.length) {
      throw new BadRequestException('Selecciona al menos un contacto');
    }

    const me = await this.usersService.findById(userId);
    if (!me) throw new NotFoundException('Usuario no encontrado');

    const contactSet = new Set(me.contactos.map((id) => id.toString()));
    for (const id of uniqueIds) {
      if (!contactSet.has(id)) {
        throw new ForbiddenException('Solo puedes compartir con tus contactos');
      }
    }

    const contacts = await this.usersService.findByIds(uniqueIds);
    if (contacts.length !== uniqueIds.length) {
      throw new NotFoundException('Algún contacto no existe');
    }

    return { me, contacts, uniqueIds };
  }

  async shareDirecta(userId: string, dto: ShareDirectaDto) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('El texto es obligatorio');

    const { me, contacts, uniqueIds } = await this.resolveContactMembers(
      userId,
      dto.contactIds,
    );

    const adminId = new Types.ObjectId(userId);
    const memberIds = [adminId, ...uniqueIds.map((id) => new Types.ObjectId(id))];
    // Guardar solo el creador: evita que fallbacks muestren "A · B · C" a receptores.
    const expiresAt = new Date(Date.now() + DAY_MS);

    const tablero = await this.tablerosRepository.create({
      nombre: me.username,
      tipoTablero: 'efimero',
      categoria: 'directa',
      adminUserId: adminId,
      inviteCode: null,
      miembros: memberIds,
      solicitudesEntrada: [],
      expiresAt,
    });

    await Promise.all(
      memberIds.map((id) => this.usersService.addTablero(id.toString(), tablero._id)),
    );

    const notifExpires = new Date(Date.now() + DAY_MS);
    await Promise.all(
      uniqueIds.map((id) =>
        this.usersService.addDirectaNotaNotification(
          id,
          adminId,
          tablero._id,
          notifExpires,
        ),
      ),
    );

    return {
      tablero: {
        ...this.tablerosRepository.toPublic(tablero),
        displayName: contacts.map((c) => c.username).join(' · '),
        miembrosInfo: [
          { id: userId, username: me.username },
          ...contacts.map((c) => ({ id: c._id.toString(), username: c.username })),
        ],
      },
      text,
    };
  }

  async createGrupo(userId: string, dto: CreateGrupoDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) throw new BadRequestException('El nombre del grupo es obligatorio');

    const text = dto.text.trim();
    if (!text) throw new BadRequestException('El texto es obligatorio');

    const { me, contacts, uniqueIds } = await this.resolveContactMembers(
      userId,
      dto.contactIds,
    );

    const adminId = new Types.ObjectId(userId);
    const memberIds = [adminId, ...uniqueIds.map((id) => new Types.ObjectId(id))];

    const tablero = await this.tablerosRepository.create({
      nombre,
      tipoTablero: 'estatico',
      categoria: 'grupo',
      adminUserId: adminId,
      inviteCode: null,
      miembros: memberIds,
      solicitudesEntrada: [],
      expiresAt: null,
    });

    await Promise.all(
      memberIds.map((id) => this.usersService.addTablero(id.toString(), tablero._id)),
    );

    const notifExpires = new Date(Date.now() + DAY_MS);
    await Promise.all(
      uniqueIds.map((id) =>
        this.usersService.addJoinTableroNotification(
          id,
          adminId,
          tablero._id,
          nombre,
          notifExpires,
        ),
      ),
    );

    return {
      tablero: {
        ...this.tablerosRepository.toPublic(tablero),
        displayName: nombre,
        miembrosInfo: [
          { id: userId, username: me.username },
          ...contacts.map((c) => ({ id: c._id.toString(), username: c.username })),
        ],
      },
      text,
    };
  }

  /** Borra tablero + todas sus notas + limpia idTableros de miembros. */
  private async deleteBoardCascade(tablero: TableroDocument) {
    const boardId = tablero._id.toString();
    await this.notasRepository.deleteAllByBoard(boardId);
    await Promise.all(
      tablero.miembros.map((id) =>
        this.usersService.removeTablero(id.toString(), tablero._id),
      ),
    );
    await this.tablerosRepository.deleteById(boardId);
  }

  async leaveGrupo(userId: string, boardId: string) {
    const tablero = await this.tablerosRepository.findById(boardId);
    if (!tablero) throw new NotFoundException('Tablero no encontrado');
    if (tablero.categoria !== 'grupo' && tablero.categoria !== 'directa') {
      throw new BadRequestException('Solo puedes salir de un tablero compartido');
    }

    const isMember = tablero.miembros.some((id) => id.toString() === userId);
    if (!isMember) throw new ForbiddenException('No perteneces a este tablero');

    const userOid = new Types.ObjectId(userId);
    const remaining = tablero.miembros.filter((id) => id.toString() !== userId);

    if (!remaining.length) {
      await this.deleteBoardCascade(tablero);
      return { ok: true, deleted: true };
    }

    await this.usersService.removeTablero(userId, tablero._id);
    await this.tablerosRepository.removeMiembro(boardId, userOid);
    if (tablero.adminUserId.toString() === userId) {
      const nextAdmin = this.pickOldestRemainingMember(tablero.miembros, userId);
      if (nextAdmin) {
        await this.tablerosRepository.setAdmin(boardId, nextAdmin);
      }
    }

    return { ok: true, deleted: false };
  }

  async deleteSharedBoard(userId: string, boardId: string) {
    const tablero = await this.tablerosRepository.findById(boardId);
    if (!tablero) throw new NotFoundException('Tablero no encontrado');

    if (tablero.categoria === 'personal') {
      throw new ForbiddenException('El tablero personal no se puede eliminar');
    }

    const isMember = tablero.miembros.some((id) => id.toString() === userId);
    if (!isMember) throw new ForbiddenException('No perteneces a este tablero');

    if (tablero.categoria === 'grupo') {
      if (tablero.adminUserId.toString() !== userId) {
        throw new ForbiddenException('Solo el admin puede eliminar el grupo');
      }
    }

    // Antes: en directa cualquier miembro podía eliminar
    // if (tablero.categoria === 'directa') { /* sin chequeo de admin */ }
    // Solo el creador (admin oculto) puede eliminar la tabla efímera
    if (tablero.categoria === 'directa') {
      if (tablero.adminUserId.toString() !== userId) {
        throw new ForbiddenException('Solo quien creó la nota puede eliminar este tablero');
      }
    }

    const memberIds = tablero.miembros.map((id) => id.toString());
    await this.deleteBoardCascade(tablero);
    this.realtimeService.emitBoardRemoved(memberIds, boardId, userId);
    return { ok: true };
  }

  private async assertGrupoAdmin(userId: string, boardId: string) {
    const tablero = await this.tablerosRepository.findById(boardId);
    if (!tablero) throw new NotFoundException('Tablero no encontrado');
    if (tablero.categoria !== 'grupo') {
      throw new BadRequestException('Solo aplica a grupos');
    }
    if (tablero.adminUserId.toString() !== userId) {
      throw new ForbiddenException('Solo el admin puede gestionar el grupo');
    }
    return tablero;
  }

  async addGrupoMiembros(userId: string, boardId: string, contactIds: string[]) {
    const tablero = await this.assertGrupoAdmin(userId, boardId);
    const { uniqueIds } = await this.resolveContactMembers(userId, contactIds);

    const already = new Set(tablero.miembros.map((id) => id.toString()));
    const toAdd = uniqueIds.filter((id) => !already.has(id));
    if (!toAdd.length) {
      throw new BadRequestException('Esos contactos ya están en el grupo');
    }

    for (const id of toAdd) {
      await this.tablerosRepository.addMiembro(boardId, new Types.ObjectId(id));
      await this.usersService.addTablero(id, tablero._id);
    }

    const notifExpires = new Date(Date.now() + DAY_MS);
    const adminId = new Types.ObjectId(userId);
    await Promise.all(
      toAdd.map((id) =>
        this.usersService.addJoinTableroNotification(
          id,
          adminId,
          tablero._id,
          tablero.nombre,
          notifExpires,
        ),
      ),
    );

    this.realtimeService.emitBoardCreated(toAdd, tablero._id.toString());

    return this.getPublicForMember(boardId, userId);
  }

  async removeGrupoMiembro(adminId: string, boardId: string, memberId: string) {
    const tablero = await this.assertGrupoAdmin(adminId, boardId);

    if (memberId === adminId) {
      throw new BadRequestException('Usa Salir para abandonar el grupo');
    }

    const isMember = tablero.miembros.some((id) => id.toString() === memberId);
    if (!isMember) throw new NotFoundException('Esa persona no está en el grupo');

    await this.tablerosRepository.removeMiembro(boardId, new Types.ObjectId(memberId));
    await this.usersService.removeTablero(memberId, tablero._id);
    this.realtimeService.emitBoardRemoved([memberId], boardId);

    return this.getPublicForMember(boardId, adminId);
  }

  async transferGrupoAdmin(userId: string, boardId: string, newAdminId: string) {
    const tablero = await this.assertGrupoAdmin(userId, boardId);

    if (newAdminId === userId) {
      throw new BadRequestException('Ya eres el admin del grupo');
    }

    const isMember = tablero.miembros.some((id) => id.toString() === newAdminId);
    if (!isMember) {
      throw new NotFoundException('Esa persona no está en el grupo');
    }

    await this.tablerosRepository.setAdmin(boardId, new Types.ObjectId(newAdminId));
    return this.getPublicForMember(boardId, userId);
  }

  async bumpExpiresAt(boardId: string) {
    return this.tablerosRepository.touchExpiresAt(
      boardId,
      new Date(Date.now() + DAY_MS),
    );
  }

  async rename(userId: string, boardId: string, nombre: string) {
    const tablero = await this.getByIdForMember(boardId, userId);
    if (tablero.categoria !== 'personal' && tablero.categoria !== 'grupo') {
      throw new ForbiddenException('Este tablero no se puede renombrar');
    }
    if (tablero.adminUserId.toString() !== userId) {
      throw new ForbiddenException('Solo el admin puede renombrar el tablero');
    }

    const updated = await this.tablerosRepository.updateNombre(boardId, nombre.trim());
    if (!updated) throw new NotFoundException('Tablero no encontrado');
    return this.tablerosRepository.toPublic(updated);
  }

  listActiveBoardsForUser(userId: string) {
    return this.tablerosRepository.findActiveForUser(userId);
  }
}
