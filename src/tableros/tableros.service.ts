import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TablerosRepository } from './tableros.repository';
import { UsersService } from '../users/users.service';
import { ShareDirectaDto } from './dto/share-directa.dto';
import { CreateGrupoDto } from './dto/create-grupo.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TablerosService {
  constructor(
    private readonly tablerosRepository: TablerosRepository,
    private readonly usersService: UsersService,
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
    const miembrosInfo = memberUsers.map((u) => ({
      id: u._id.toString(),
      username: u.username,
    }));

    return {
      ...this.tablerosRepository.toPublic(tablero),
      displayName: this.displayNameForUser(tablero, userId, miembrosInfo),
      miembrosInfo,
    };
  }

  private displayNameForUser(
    tablero: { categoria: string; nombre: string },
    userId: string,
    miembrosInfo: { id: string; username: string }[],
  ) {
    if (tablero.categoria === 'personal') return 'Mi tablero';
    if (tablero.categoria === 'grupo') return tablero.nombre;

    const others = miembrosInfo
      .filter((m) => m.id !== userId)
      .map((m) => m.username);
    if (others.length) return others.join(' · ');
    return tablero.nombre;
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
    const nombres = [me.username, ...contacts.map((c) => c.username)];
    const expiresAt = new Date(Date.now() + DAY_MS);

    const tablero = await this.tablerosRepository.create({
      nombre: nombres.join(' · '),
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

  async leaveGrupo(userId: string, boardId: string) {
    const tablero = await this.tablerosRepository.findById(boardId);
    if (!tablero) throw new NotFoundException('Tablero no encontrado');
    if (tablero.categoria !== 'grupo') {
      throw new BadRequestException('Solo puedes salir de un grupo');
    }

    const isMember = tablero.miembros.some((id) => id.toString() === userId);
    if (!isMember) throw new ForbiddenException('No perteneces a este grupo');

    const userOid = new Types.ObjectId(userId);
    const remaining = tablero.miembros.filter((id) => id.toString() !== userId);

    await this.usersService.removeTablero(userId, tablero._id);

    if (!remaining.length) {
      await this.tablerosRepository.deleteById(boardId);
      return { ok: true, deleted: true };
    }

    await this.tablerosRepository.removeMiembro(boardId, userOid);
    if (tablero.adminUserId.toString() === userId && remaining[0]) {
      await this.tablerosRepository.setAdmin(boardId, remaining[0]);
    }

    return { ok: true, deleted: false };
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
