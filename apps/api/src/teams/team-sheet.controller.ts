import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { TenantInterceptor } from '../tenant/tenant.interceptor';
import { SaveTeamSheetDto, VersionedCommandDto } from '../gameday/gameday.dto';
import { TeamSheetService } from './team-sheet.service';

@Controller('team-matches')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class TeamSheetController {
  constructor(private readonly sheets: TeamSheetService) {}

  @Get()
  list() {
    return this.sheets.listMatches();
  }

  @Get(':id/team-sheet')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sheets.detail(id);
  }

  @Put(':id/team-sheet')
  save(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveTeamSheetDto) {
    return this.sheets.save(id, dto);
  }

  @Post(':id/team-sheet/submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.sheets.submit(id, dto.expectedVersion, req.user.userId);
  }
}
