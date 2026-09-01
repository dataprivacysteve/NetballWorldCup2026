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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, SportsbbAdminGuard } from '../auth/auth.guard';
import { MatchAdminService } from '../admin/match-admin.service';
import {
  AssignGameDayOfficialDto,
  CreateGameDayAccountDto,
  GAME_DAY_ROLES,
  type GameDayRole,
} from '../gameday/gameday.dto';
import {
  CreateEligibleCountryDto,
  UpdateEligibleCountryDto,
  UpdateLaunchConfigurationDto,
  UpdateGymDisplayModeDto,
  UpdatePublicExperienceDto,
  UpdatePublicSiteModeDto,
  SaveSponsorDto,
  SaveNewsArticleDto,
} from './control.dto';
import { ControlService } from './control.service';

type AuthorizedRequest = Request & { user: { userId: string } };

@Controller('control')
@UseGuards(AuthGuard, SportsbbAdminGuard)
export class ControlController {
  constructor(
    private readonly control: ControlService,
    private readonly matchAdmin: MatchAdminService,
  ) {}

  @Get('configuration')
  configuration() {
    return this.control.configuration();
  }

  @Patch('configuration')
  updateConfiguration(
    @Body() dto: UpdateLaunchConfigurationDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.updateConfiguration(dto, req.user.userId);
  }

  @Post('configuration/publish')
  publish(@Req() req: AuthorizedRequest) {
    return this.control.publish(req.user.userId);
  }

  @Post('configuration/lock')
  lock(@Req() req: AuthorizedRequest) {
    return this.control.lock(req.user.userId);
  }

  @Get('countries')
  countries() {
    return this.control.countries();
  }

  @Post('countries')
  addCountry(
    @Body() dto: CreateEligibleCountryDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.addCountry(dto, req.user.userId);
  }

  @Patch('countries/:code')
  updateCountry(
    @Param('code') code: string,
    @Body() dto: UpdateEligibleCountryDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.updateCountry(code, dto, req.user.userId);
  }

  @Delete('countries/:code')
  removeCountry(@Param('code') code: string, @Req() req: AuthorizedRequest) {
    return this.control.removeCountry(code, req.user.userId);
  }

  @Get('audit')
  audit() {
    return this.control.auditHistory();
  }

  @Get('public-experience')
  publicExperience() {
    return this.control.publicExperience();
  }

  @Patch('public-site-mode')
  updatePublicSiteMode(
    @Body() dto: UpdatePublicSiteModeDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.updatePublicSiteMode(dto.live, req.user.userId);
  }

  @Patch('gym-display-mode')
  updateGymDisplayMode(
    @Body() dto: UpdateGymDisplayModeDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.updateGymDisplayMode(dto.mode, req.user.userId);
  }

  @Patch('public-experience')
  updatePublicExperience(
    @Body() dto: UpdatePublicExperienceDto,
    @Req() req: AuthorizedRequest,
  ) {
    return this.control.updatePublicExperience(dto, req.user.userId);
  }

  @Post('sponsors')
  saveSponsor(@Body() dto: SaveSponsorDto, @Req() req: AuthorizedRequest) {
    return this.control.saveSponsor(dto, req.user.userId);
  }

  @Delete('sponsors/:id')
  deleteSponsor(@Param('id') id: string, @Req() req: AuthorizedRequest) {
    return this.control.deleteSponsor(id, req.user.userId);
  }

  @Post('news')
  saveNews(@Body() dto: SaveNewsArticleDto, @Req() req: AuthorizedRequest) {
    return this.control.saveNews(dto, req.user.userId);
  }

  @Delete('news/:id')
  deleteNews(@Param('id') id: string, @Req() req: AuthorizedRequest) {
    return this.control.deleteNews(id, req.user.userId);
  }

  // SportsBB owns the match-day staffing contract. These focused endpoints
  // reuse the existing match writer without exposing the LOC registration UI.
  @Get('gameday/matches')
  gameDayMatches() {
    return this.matchAdmin.listMatches();
  }

  @Get('gameday/accounts')
  gameDayAccounts() {
    return this.matchAdmin.listGameDayAccounts();
  }

  @Post('gameday/accounts')
  createGameDayAccount(@Body() dto: CreateGameDayAccountDto) {
    return this.matchAdmin.createGameDayAccount(dto);
  }

  @Get('gameday/matches/:id/assignments')
  gameDayAssignments(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchAdmin.listAssignments(id);
  }

  @Post('gameday/matches/:id/assignments')
  assignGameDayOfficial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignGameDayOfficialDto,
  ) {
    return this.matchAdmin.assignOfficial(id, dto);
  }

  @Delete('gameday/matches/:id/assignments/:role')
  unassignGameDayOfficial(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: GameDayRole,
  ) {
    if (!GAME_DAY_ROLES.includes(role)) {
      throw new BadRequestException('Unknown GameDay role');
    }
    return this.matchAdmin.unassignOfficial(id, role);
  }
}
