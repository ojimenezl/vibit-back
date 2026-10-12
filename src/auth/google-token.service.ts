import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export type VerifiedGoogleIdentity = {
  googleId: string;
  email: string | null;
};

@Injectable()
export class GoogleTokenService {
  private readonly client: OAuth2Client;
  private readonly audience: string[];

  constructor(private readonly config: ConfigService) {
    const webClientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
    this.client = new OAuth2Client(webClientId || undefined);
    this.audience = webClientId ? [webClientId] : [];
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const token = idToken.trim();
    if (!token) {
      throw new UnauthorizedException('Token de Google inválido');
    }
    if (!this.audience.length) {
      throw new UnauthorizedException('GOOGLE_CLIENT_ID no configurado en el servidor');
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.audience,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('No se pudo verificar la cuenta de Google');
    }

    const googleId = payload?.sub?.trim();
    if (!googleId) {
      throw new UnauthorizedException('Cuenta de Google inválida');
    }

    return {
      googleId,
      email: payload?.email?.trim().toLowerCase() || null,
    };
  }
}
