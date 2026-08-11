import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ContactsRepository } from './contacts.repository';

const NOTIF_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ContactsService {
  constructor(private readonly contactsRepository: ContactsRepository) {}

  private expiresIn24h() {
    return new Date(Date.now() + NOTIF_TTL_MS);
  }

  private toContactPublic(user: { _id: Types.ObjectId; username: string; linkUser: string }) {
    return {
      id: user._id.toString(),
      username: user.username,
      linkUser: user.linkUser,
    };
  }

  async getProfileLink(userId: string) {
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      linkUser: user.linkUser,
      path: `/u/${user.linkUser}`,
    };
  }

  async getPublicProfile(linkUser: string) {
    const user = await this.contactsRepository.findByLinkUser(linkUser.trim());
    if (!user) throw new NotFoundException('Perfil no encontrado');
    return {
      username: user.username,
      linkUser: user.linkUser,
    };
  }

  async listContacts(userId: string) {
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const contacts = await this.contactsRepository.findManyByIds(user.contactos);
    return contacts.map((c) => this.toContactPublic(c));
  }

  async listNotifications(userId: string) {
    await this.contactsRepository.purgeExpiredNotifications(userId);
    await this.contactsRepository.ensureNotificationIds(userId);
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const notifs = user.notificaciones ?? [];
    const fromIds = [
      ...new Set(
        notifs
          .filter((n) => n?.fromUserId)
          .map((n) => n.fromUserId.toString()),
      ),
    ];
    const fromUsers = await this.contactsRepository.findManyByIds(
      fromIds.map((id) => new Types.ObjectId(id)),
    );
    const nameMap = new Map(fromUsers.map((u) => [u._id.toString(), u.username]));

    const visible = new Set([
      'contacto',
      'contacto_aceptado',
      'solicitud_enviada',
      'contacto_nuevo',
    ]);

    return notifs
      .filter((n) => n?._id && n?.fromUserId && visible.has(n.tipo))
      .map((n) => ({
        id: n._id.toString(),
        tipo: n.tipo,
        fromUserId: n.fromUserId.toString(),
        fromUsername: nameMap.get(n.fromUserId.toString()) ?? 'Usuario',
        createdAt: n.createdAt,
        expiresAt: n.expiresAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
  }

  private isContact(user: { contactos: Types.ObjectId[] }, otherId: string) {
    return user.contactos.some((id) => id.toString() === otherId);
  }

  private hasPendingContactRequest(
    user: { notificaciones: { tipo: string; fromUserId: Types.ObjectId }[] },
    fromUserId: string,
  ) {
    return user.notificaciones.some(
      (n) => n.tipo === 'contacto' && n.fromUserId.toString() === fromUserId,
    );
  }

  async requestContact(requesterId: string, linkUser: string) {
    const target = await this.contactsRepository.findByLinkUser(linkUser.trim());
    if (!target) throw new NotFoundException('Perfil no encontrado');

    if (target._id.toString() === requesterId) {
      throw new BadRequestException('No puedes agregarte a ti mismo');
    }

    const requester = await this.contactsRepository.findById(requesterId);
    if (!requester) throw new NotFoundException('Usuario no encontrado');

    if (this.isContact(target, requesterId) || this.isContact(requester, target._id.toString())) {
      throw new ConflictException('Ya son contactos');
    }

    if (this.hasPendingContactRequest(target, requesterId)) {
      throw new ConflictException('Ya enviaste una solicitud a esta persona');
    }

    // Si la otra persona ya te pidió, sugiere aceptar
    if (this.hasPendingContactRequest(requester, target._id.toString())) {
      throw new ConflictException('Esta persona ya te envió solicitud. Revísala en notificaciones.');
    }

    const expires = this.expiresIn24h();

    // B: solicitud para aceptar/rechazar
    await this.contactsRepository.addContactRequest(
      target._id.toString(),
      new Types.ObjectId(requesterId),
      expires,
    );

    // A: confirmación de envío (fromUserId = destino)
    await this.contactsRepository.addNotification(
      requesterId,
      'solicitud_enviada',
      target._id,
      expires,
    );

    return {
      ok: true,
      message: 'Solicitud enviada',
      targetUsername: target.username,
    };
  }

  async acceptNotification(userId: string, notificationId: string) {
    await this.contactsRepository.ensureNotificationIds(userId);
    await this.contactsRepository.purgeExpiredNotifications(userId);
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let notif = this.contactsRepository.findNotificationOnUser(user, notificationId);

    // Fallback: id efímero viejo del front → si solo hay una solicitud pendiente, úsala
    if (!notif) {
      const pending = user.notificaciones.filter((n) => n.tipo === 'contacto');
      if (pending.length === 1) notif = pending[0];
    }

    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (notif.tipo !== 'contacto') {
      throw new BadRequestException('Esta notificación no se puede aceptar');
    }
    if (notif.expiresAt && notif.expiresAt <= new Date()) {
      await this.contactsRepository.removeNotification(userId, notif._id.toString());
      throw new BadRequestException('La solicitud expiró');
    }

    const requesterId = notif.fromUserId.toString();
    const expires = this.expiresIn24h();
    await this.contactsRepository.addMutualContact(userId, requesterId);
    await this.contactsRepository.removeNotification(userId, notif._id.toString());
    await this.contactsRepository.removeOutgoingRequestNotice(requesterId, userId);

    // A: te aceptaron
    await this.contactsRepository.addAcceptedNotification(
      requesterId,
      new Types.ObjectId(userId),
      expires,
    );

    // B: nuevo contacto confirmado
    await this.contactsRepository.addNotification(
      userId,
      'contacto_nuevo',
      new Types.ObjectId(requesterId),
      expires,
    );

    const requester = await this.contactsRepository.findById(requesterId);
    return {
      ok: true,
      contact: requester
        ? this.toContactPublic(requester)
        : { id: requesterId, username: 'Usuario', linkUser: '' },
    };
  }

  async rejectNotification(userId: string, notificationId: string) {
    await this.contactsRepository.ensureNotificationIds(userId);
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let notif = this.contactsRepository.findNotificationOnUser(user, notificationId);
    if (!notif) {
      const pending = user.notificaciones.filter((n) => n.tipo === 'contacto');
      if (pending.length === 1) notif = pending[0];
    }

    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (notif.tipo !== 'contacto') {
      throw new BadRequestException('Esta notificación no se puede rechazar');
    }

    await this.contactsRepository.removeNotification(userId, notif._id.toString());
    await this.contactsRepository.removeOutgoingRequestNotice(
      notif.fromUserId.toString(),
      userId,
    );
    return { ok: true };
  }

  async dismissNotification(userId: string, notificationId: string) {
    await this.contactsRepository.ensureNotificationIds(userId);
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let notif = this.contactsRepository.findNotificationOnUser(user, notificationId);
    if (!notif) {
      const dismissible = user.notificaciones.filter(
        (n) =>
          n.tipo === 'contacto_aceptado' ||
          n.tipo === 'solicitud_enviada' ||
          n.tipo === 'contacto_nuevo',
      );
      if (dismissible.length === 1) notif = dismissible[0];
    }

    if (!notif) throw new NotFoundException('Notificación no encontrada');
    if (
      notif.tipo !== 'contacto_aceptado' &&
      notif.tipo !== 'solicitud_enviada' &&
      notif.tipo !== 'contacto_nuevo'
    ) {
      throw new BadRequestException('Esta notificación no se puede cerrar así');
    }

    await this.contactsRepository.removeNotification(userId, notif._id.toString());
    return { ok: true };
  }

  async removeContact(userId: string, contactId: string) {
    const user = await this.contactsRepository.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!this.isContact(user, contactId)) {
      throw new ForbiddenException('No es tu contacto');
    }

    await this.contactsRepository.removeMutualContact(userId, contactId);
    return { ok: true };
  }
}
