import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, StatsGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.service';
import { PositionChangeDto } from './gameday.dto';
import { GameDayService } from './gameday.service';
import { CorrectStatsEventDto, RecordStatsEventDto } from './stats.dto';

type StatsRequest = Request & { user: SessionUser };

@Controller('stats')
@UseGuards(AuthGuard, StatsGuard)
export class StatsController {
  constructor(private readonly gameDay: GameDayService) {}

  @Get('matches')
  matches(@Req() req: StatsRequest) {
    return this.gameDay.assignedMatches(req.user.userId, req.user.platformRole);
  }

  @Get('matches/:id')
  match(@Param('id', ParseUUIDPipe) id: string, @Req() req: StatsRequest) {
    return this.gameDay.matchState(id, req.user.userId, req.user.platformRole);
  }

  @Post('matches/:id/events')
  record(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordStatsEventDto,
    @Req() req: StatsRequest,
  ) {
    return this.gameDay.recordStatsEvent(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/events/correct')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectStatsEventDto,
    @Req() req: StatsRequest,
  ) {
    return this.gameDay.correctStatsEvent(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/positions')
  position(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PositionChangeDto,
    @Req() req: StatsRequest,
  ) {
    return this.gameDay.positionChange(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }
}
