import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, SportsbbAdminGuard } from '../auth/auth.guard';
import {
  CreateEligibleCountryDto,
  UpdateEligibleCountryDto,
  UpdateLaunchConfigurationDto,
  UpdatePublicExperienceDto,
  SaveSponsorDto,
  SaveNewsArticleDto,
} from './control.dto';
import { ControlService } from './control.service';

type AuthorizedRequest = Request & { user: { userId: string } };

@Controller('control')
@UseGuards(AuthGuard, SportsbbAdminGuard)
export class ControlController {
  constructor(private readonly control: ControlService) {}

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
}
