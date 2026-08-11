import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      service: 'vibit-back',
      timestamp: new Date().toISOString(),
    };
  }
}
