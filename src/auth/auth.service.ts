import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { TablerosService } from '../tableros/tableros.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePinDto } from './dto/change-pin.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tablerosService: TablerosService,
    private readonly jwtService: JwtService,
  ) {}

  private generateUserCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const chunk = (len: number) =>
      Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
        '',
      );
    return `${chunk(4)}-${chunk(4)}`;
  }

  private generateLinkUser(): string {
    return randomBytes(6).toString('hex');
  }

  private async uniqueUserCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = this.generateUserCode();
      const exists = await this.usersService.findByUserCode(code);
      if (!exists) return code;
    }
    throw new Error('No se pudo generar userCode único');
  }

  private signToken(userId: string, userCode: string) {
    return this.jwtService.signAsync({
      sub: userId,
      userCode,
    });
  }

  async register(dto: RegisterDto) {
    const username = dto.username.trim();
    const userCode = await this.uniqueUserCode();
    const pinHash = await bcrypt.hash(dto.pin, 12);
    const linkUser = this.generateLinkUser();

    const user = await this.usersService.create({
      username,
      userCode,
      linkUser,
      pinHash,
      contactos: [],
      notificaciones: [],
      idTableros: [],
      fcmTokens: [],
      googleId: null,
    });

    const tablero = await this.tablerosService.createPersonal(user._id.toString(), username);
    await this.usersService.addTablero(user._id.toString(), tablero._id);

    const accessToken = await this.signToken(user._id.toString(), user.userCode);
    const publicUser = this.usersService.toPublic(
      (await this.usersService.findById(user._id.toString()))!,
    );

    return {
      accessToken,
      user: publicUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUserCode(dto.userCode.trim().toUpperCase());
    if (!user) {
      throw new UnauthorizedException('Código o PIN incorrectos');
    }

    const ok = await bcrypt.compare(dto.pin, user.pinHash);
    if (!ok) {
      throw new UnauthorizedException('Código o PIN incorrectos');
    }

    const accessToken = await this.signToken(user._id.toString(), user.userCode);
    return {
      accessToken,
      user: this.usersService.toPublic(user),
    };
  }

  async verifyPin(userId: string, pin: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new UnauthorizedException('PIN incorrecto');

    return {
      ok: true,
      userCode: user.userCode,
      username: user.username,
      hasGoogle: Boolean(user.googleId),
    };
  }

  async changePin(userId: string, dto: ChangePinDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const ok = await bcrypt.compare(dto.currentPin, user.pinHash);
    if (!ok) throw new UnauthorizedException('PIN actual incorrecto');

    if (dto.currentPin === dto.newPin) {
      throw new BadRequestException('El nuevo PIN debe ser distinto');
    }

    const pinHash = await bcrypt.hash(dto.newPin, 12);
    await this.usersService.updatePinHash(userId, pinHash);
    return { ok: true };
  }
}
