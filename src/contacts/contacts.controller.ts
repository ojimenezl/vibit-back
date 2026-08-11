import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContactsService } from './contacts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('contacts')
@UseGuards(AuthGuard('jwt'))
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.contactsService.listContacts(user.userId);
  }

  @Get('profile')
  profileLink(@CurrentUser() user: JwtPayloadUser) {
    return this.contactsService.getProfileLink(user.userId);
  }

  @Get('u/:linkUser')
  publicProfile(@Param('linkUser') linkUser: string) {
    return this.contactsService.getPublicProfile(linkUser);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: JwtPayloadUser) {
    return this.contactsService.listNotifications(user.userId);
  }

  @Post('request/:linkUser')
  request(@CurrentUser() user: JwtPayloadUser, @Param('linkUser') linkUser: string) {
    return this.contactsService.requestContact(user.userId, linkUser);
  }

  @Post('notifications/:id/accept')
  accept(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.contactsService.acceptNotification(user.userId, id);
  }

  @Post('notifications/:id/reject')
  reject(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.contactsService.rejectNotification(user.userId, id);
  }

  @Post('notifications/:id/dismiss')
  dismiss(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.contactsService.dismissNotification(user.userId, id);
  }

  @Delete(':contactId')
  remove(@CurrentUser() user: JwtPayloadUser, @Param('contactId') contactId: string) {
    return this.contactsService.removeContact(user.userId, contactId);
  }
}
