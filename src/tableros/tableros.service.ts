import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TablerosRepository } from './tableros.repository';
import { UsersService } from '../users/users.service';

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

    // Usuarios viejos sin tablero personal: se crea al vuelo
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

    return tablero;
  }

  async rename(userId: string, boardId: string, nombre: string) {
    const tablero = await this.getByIdForMember(boardId, userId);
    if (tablero.adminUserId.toString() !== userId) {
      throw new ForbiddenException('Solo el admin puede renombrar el tablero');
    }

    const updated = await this.tablerosRepository.updateNombre(boardId, nombre.trim());
    if (!updated) throw new NotFoundException('Tablero no encontrado');
    return this.tablerosRepository.toPublic(updated);
  }
}
