import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WidgetService } from './widget.service';
import { MarkWidgetSeenDto } from './dto/mark-seen.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('widget')
@UseGuards(AuthGuard('jwt'))
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Get('feed')
  feed(@CurrentUser() user: JwtPayloadUser) {
    return this.widgetService.getFeed(user.userId);
  }

  @Post('seen')
  markSeen(@CurrentUser() user: JwtPayloadUser, @Body() dto: MarkWidgetSeenDto) {
    return this.widgetService.markSeen(user.userId, dto.boardId);
  }
}
