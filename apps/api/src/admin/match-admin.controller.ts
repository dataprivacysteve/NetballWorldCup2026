import {
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
import { AuthGuard, AdminGuard } from '../auth/auth.guard';
import { MatchAdminService } from './match-admin.service';
import {
  CreateMatchDto,
  CreateStageDto,
  EntryDto,
  UpdateMatchDto,
} from './match-admin.dto';

// OC match-centre management (Module 4 writer). Admin-only.
@Controller('admin/match')
@UseGuards(AuthGuard, AdminGuard)
export class MatchAdminController {
  constructor(private readonly svc: MatchAdminService) {}

  @Get('nations')
  nations() {
    return this.svc.listNations();
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
}
