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

  /** Silent data-only push so Android refreshes the home widget without a tray notification. */
  async notifyWidgetSync(userIds: string[], excludeUserId?: string) {
    if (!this.ready) return;

    const unique = [...new Set(userIds)].filter((id) => id && id !== excludeUserId);
    if (!unique.length) return;

    const users = await this.usersService.findByIds(unique);
    const tokens = [
      ...new Set(users.flatMap((u) => u.fcmTokens ?? []).filter(Boolean)),
    ];
    if (!tokens.length) return;

    const invalid: string[] = [];

    // FCM allows up to 500 tokens per multicast
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: chunk,
          // No "notification" key → silent / data-only
          data: {
            type: 'widget_sync',
          },
          android: {
            priority: 'high',
          },
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
}
