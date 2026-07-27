import {
  AssignGameDayOfficialDto,
  CreateGameDayAccountDto,
  GAME_DAY_ROLES,
  type GameDayRole,
} from '../gameday/gameday.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, LocOfficerGuard } from '../auth/auth.guard';
import { MatchAdminService } from './match-admin.service';
import {
  CreateMatchDto,
  CreateCourtDto,
  CreateStageDto,
  CreateVenueDto,
  EntryDto,
  UpdateMatchDto,
  UpsertMatchBroadcastDto,
  CreateEdgeNodeDto,
} from './match-admin.dto';

// OC match-centre management (Module 4 writer). Admin-only.
@Controller('admin/match')
@UseGuards(AuthGuard, LocOfficerGuard)
export class MatchAdminController {
  constructor(private readonly svc: MatchAdminService) {}

  @Get('nations')
  nations() {
    return this.svc.listNations();
  }

  @Get('officials')
  officials() {
    return this.svc.listGameDayAccounts();
  }

  @Post('officials')
  createOfficial(@Body() dto: CreateGameDayAccountDto) {
    return this.svc.createGameDayAccount(dto);
  }

  @Get('matches/:id/assignments')
  assignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listAssignments(id);
  }

  @Post('matches/:id/assignments')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGameDayOfficialDto,
  ) {
    return this.svc.assignOfficial(id, dto);
  }

  @Delete('matches/:id/assignments/:role')
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: GameDayRole,
  ) {
    if (!GAME_DAY_ROLES.includes(role)) {
      throw new BadRequestException('Unknown GameDay role');
    }
    return this.svc.unassignOfficial(id, role);
  }

  @Get('venues')
  venues() {
    return this.svc.listVenues();
  }

  @Get('edge-nodes')
  edgeNodes() {
    return this.svc.listEdgeNodes();
  }

  @Post('edge-nodes')
  createEdgeNode(@Body() dto: CreateEdgeNodeDto) {
    return this.svc.createEdgeNode(dto);
  }

  @Delete('edge-nodes/:id')
  deactivateEdgeNode(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deactivateEdgeNode(id);
  }

  @Post('venues')
  createVenue(@Body() dto: CreateVenueDto) {
    return this.svc.createVenue(dto);
  }

  @Post('venues/:id/courts')
  createCourt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCourtDto,
  ) {
    return this.svc.createCourt(id, dto);
  }

  @Get('stages')
  stages() {
    return this.svc.listStages();
  }

  @Post('stages')
  createStage(@Body() dto: CreateStageDto) {
    return this.svc.createStage(dto);
  }

  @Post('stages/:id/entries')
  addEntry(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EntryDto) {
    return this.svc.addEntry(id, dto.delegationId);
  }

  @Delete('stages/:id/entries/:delegationId')
  removeEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('delegationId', ParseUUIDPipe) delegationId: string,
  ) {
    return this.svc.removeEntry(id, delegationId);
  }

  @Get('matches')
  matches() {
    return this.svc.listMatches();
  }

  @Post('matches')
  createMatch(@Body() dto: CreateMatchDto) {
    return this.svc.createMatch(dto);
  }

  @Patch('matches/:id')
  updateMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.svc.updateMatch(id, dto);
  }

  @Delete('matches/:id')
  deleteMatch(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteMatch(id);
  }

  @Get('matches/:id/broadcast')
  broadcast(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getBroadcast(id);
  }

  @Patch('matches/:id/broadcast')
  updateBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertMatchBroadcastDto,
  ) {
    return this.svc.upsertBroadcast(id, dto);
  }
}
