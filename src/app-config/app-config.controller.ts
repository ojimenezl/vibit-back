import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Config pública de la app (sin auth).
 * Usado p.ej. para aviso soft de actualización en Android.
 */
@Controller('app')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('config')
  getConfig() {
    const raw = this.config.get<string>('MIN_ANDROID_VERSION_CODE', '0');
    const parsed = Number.parseInt(String(raw).trim(), 10);
    const minAndroidVersionCode = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    return {
      minAndroidVersionCode,
      playStoreUrl:
        this.config.get<string>('PLAY_STORE_URL')?.trim() ||
        'https://play.google.com/store/apps/details?id=com.vibit.app',
      message:
        this.config.get<string>('UPDATE_MESSAGE')?.trim() ||
        'Hay una nueva versión de Vibit con mejoras y correcciones. Actualízala cuando puedas.',
    };
  }
}
