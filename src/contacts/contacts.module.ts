import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    RealtimeModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
