import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { UsersService } from '../users/users.service';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private ready = false;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    try {
      if (admin.apps.length) {
        this.ready = true;
        return;
      }

      const jsonInline = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
      const credPath = this.config.get<string>('FIREBASE_CREDENTIALS_PATH');

      if (jsonInline?.trim()) {
        const parsed = JSON.parse(jsonInline) as admin.ServiceAccount;
        admin.initializeApp({ credential: admin.credential.cert(parsed) });
        this.ready = true;
        this.logger.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT');
        return;
      }

      if (credPath?.trim()) {
        const absolute = path.isAbsolute(credPath)
          ? credPath
          : path.resolve(process.cwd(), credPath);
        const raw = fs.readFileSync(absolute, 'utf8');
        const parsed = JSON.parse(raw) as admin.ServiceAccount;
        admin.initializeApp({ credential: admin.credential.cert(parsed) });
        this.ready = true;
        this.logger.log(`Firebase Admin initialized from ${absolute}`);
        return;
      }

      this.logger.warn(
        'Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT or FIREBASE_CREDENTIALS_PATH)',
      );
    } catch (err) {
      this.logger.error(
        `Firebase Admin init failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async collectTokens(userIds: string[], excludeUserId?: string) {
    const unique = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
    if (!unique.length) return [] as string[];

    const users = await this.usersService.findByIds(unique);
    return [
      ...new Set(users.flatMap((u) => u.fcmTokens ?? []).filter(Boolean)),
    ];
  }

  private async sendMulticast(
    tokens: string[],
    message: Omit<admin.messaging.MulticastMessage, 'tokens'>,
  ) {
    if (!tokens.length) return;

    const invalid: string[] = [];

    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          ...message,
        });

        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code ?? '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              invalid.push(chunk[idx]);
            } else {
              this.logger.debug(`FCM fail: ${code} ${r.error?.message ?? ''}`);
            }
          }
        });
      } catch (err) {
        this.logger.warn(
          `FCM multicast error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await Promise.all(invalid.map((t) => this.usersService.removeFcmToken(t)));
  }

  /** Silent data-only push so Android refreshes the home widget without a tray notification. */
  async notifyWidgetSync(userIds: string[], excludeUserId?: string) {
    if (!this.ready) return;

    const tokens = await this.collectTokens(userIds, excludeUserId);
    await this.sendMulticast(tokens, {
      data: {
        type: 'widget_sync',
      },
      android: {
        priority: 'high',
      },
    });
  }

  /**
   * Tray notification (amigos). Solo para eventos explícitos de contacto;
   * el resto del producto sigue sin notificaciones al móvil.
   */
  async notifyTray(
    userIds: string[],
    opts: {
      body: string;
      title?: string;
      type: string;
      excludeUserId?: string;
    },
  ) {
    if (!this.ready) return;

    const tokens = await this.collectTokens(userIds, opts.excludeUserId);
    const title = opts.title?.trim() || 'Vibit';
    const body = opts.body.trim();
    if (!body || !tokens.length) return;

    await this.sendMulticast(tokens, {
      notification: {
        title,
        body,
      },
      data: {
        type: opts.type,
        body,
        title,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'vibit_friends',
          sound: 'default',
        },
      },
    });
  }
}
