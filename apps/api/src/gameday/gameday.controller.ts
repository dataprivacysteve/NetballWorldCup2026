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
import { AuthGuard, GameDayOfficialGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.service';
import {
  ClockCommandDto,
  CentrePassDto,
  ConfirmResultDto,
  CorrectGoalDto,
  GoalDto,
  IncidentDto,
  PositionChangeDto,
  StatisticDto,
  VersionedCommandDto,
} from './gameday.dto';
import { GameDayService } from './gameday.service';

type OfficialRequest = Request & { user: SessionUser };

@Controller('gameday')
@UseGuards(AuthGuard, GameDayOfficialGuard)
export class GameDayController {
  constructor(private readonly gameDay: GameDayService) {}

  @Get('matches')
  matches(@Req() req: OfficialRequest) {
    return this.gameDay.assignedMatches(req.user.userId, req.user.platformRole);
  }

  @Get('runtime')
  runtime() {
    return this.gameDay.runtimeStatus();
  }

  @Get('matches/:id')
  match(@Param('id', ParseUUIDPipe) id: string, @Req() req: OfficialRequest) {
    return this.gameDay.matchState(id, req.user.userId, req.user.platformRole);
  }

  @Post('matches/:id/ready')
  ready(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.readyMatch(
      id,
      req.user.userId,
      req.user.platformRole,
      dto.expectedVersion,
    );
  }

  @Post('matches/:id/goals')
  goal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GoalDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.recordGoal(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/goals/correct')
  correctGoal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectGoalDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.correctGoal(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/centre-pass')
  centrePass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CentrePassDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.setCentrePass(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/incidents')
  incident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IncidentDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.recordIncident(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/clock')
  clock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClockCommandDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.clockCommand(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/lineup')
  lineup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PositionChangeDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.positionChange(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/statistics')
  statistic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatisticDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.recordStatistic(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }

  @Post('matches/:id/result/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmResultDto,
    @Req() req: OfficialRequest,
  ) {
    return this.gameDay.confirmResult(
      id,
      req.user.userId,
      req.user.platformRole,
      dto,
    );
  }
}
