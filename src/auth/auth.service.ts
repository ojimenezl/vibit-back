import {
  BadRequestException,
  ConflictException,
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
import { GoogleTokenService } from './google-token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tablerosService: TablerosService,
    private readonly jwtService: JwtService,
    private readonly googleTokenService: GoogleTokenService,
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

    let googleId: string | null = null;
    let googleEmail: string | null = null;
    if (dto.idToken?.trim()) {
      const identity = await this.googleTokenService.verifyIdToken(dto.idToken);
      const other = await this.usersService.findByGoogleId(identity.googleId);
      if (other) {
        throw new ConflictException('Esa cuenta de Google ya está vinculada a otro Vibit');
      }
      googleId = identity.googleId;
      googleEmail = identity.email;
    }

    const user = await this.usersService.create({
      username,
      userCode,
      linkUser,
      pinHash,
      contactos: [],
      notificaciones: [],
      idTableros: [],
      fcmTokens: [],
      googleId,
      googleEmail,
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

  /** Vincula Google a la cuenta ya logueada (tras onboarding normal). */
  async linkGoogle(userId: string, idToken: string) {
    const identity = await this.googleTokenService.verifyIdToken(idToken);
    const current = await this.usersService.findById(userId);
    if (!current) throw new NotFoundException('Usuario no encontrado');

    if (current.googleId && current.googleId !== identity.googleId) {
      throw new ConflictException('Esta cuenta Vibit ya tiene otro Google vinculado');
    }

    const other = await this.usersService.findByGoogleId(identity.googleId);
    if (other && other._id.toString() !== userId) {
      throw new ConflictException('Esa cuenta de Google ya está vinculada a otro Vibit');
    }

    const updated = await this.usersService.linkGoogle(
      userId,
      identity.googleId,
      identity.email,
    );
    if (!updated) throw new NotFoundException('Usuario no encontrado');

    return {
      ok: true,
      user: this.usersService.toPublic(updated),
    };
  }

  /**
   * Si Google ya está vinculado → login.
   * Si no → needsOnboarding para que el front complete username + PIN y registre con idToken.
   */
  async loginWithGoogle(idToken: string) {
    const identity = await this.googleTokenService.verifyIdToken(idToken);
    const user = await this.usersService.findByGoogleId(identity.googleId);
    if (user) {
      const accessToken = await this.signToken(user._id.toString(), user.userCode);
      return {
        needsOnboarding: false as const,
        accessToken,
        user: this.usersService.toPublic(user),
      };
    }

    const emailLocal = identity.email?.split('@')[0]?.trim() || '';
    const suggestedUsername = emailLocal
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 32);

    return {
      needsOnboarding: true as const,
      suggestedUsername: suggestedUsername.length >= 2 ? suggestedUsername : '',
      googleEmail: identity.email,
    };
  }
}
