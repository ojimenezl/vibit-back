import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PushService } from './push.service';

@Module({
  imports: [UsersModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
