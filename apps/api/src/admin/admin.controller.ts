import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, AdminGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';
import { ReturnRosterDto, ScanDto, SetWindowDto } from './admin.dto';
import { qrPng } from './qr.util';

// Stopgap OC console endpoints. Admin-only; not tenant-scoped — acts across
// delegations via the privileged pool.
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Registration approval ---
  @Get('delegations')
  pendingRegistrations() {
    return this.admin.listPendingRegistrations();
  }

  @Post('delegations/:id/approve')
  approveRegistration(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveRegistration(id);
  }

  @Post('delegations/:id/reject')
  rejectRegistration(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.rejectRegistration(id);
  }

  // --- Registration window (cutoff) ---
  @Get('registration-window')
  registrationWindow() {
    return this.admin.getRegistrationWindow();
  }

  @Patch('registration-window')
  setRegistrationWindow(@Body() dto: SetWindowDto) {
    return this.admin.setRegistrationWindow(
      dto.closesAt ? new Date(dto.closesAt) : null,
    );
  }

  // --- Badges + gate scan ---
  @Get('accredited')
  accredited() {
    return this.admin.listAccredited();
  }

  @Post('scan/verify')
  scanVerify(@Body() dto: ScanDto) {
    return this.admin.verifyScan(dto.token);
  }

  // --- Roster accreditation review ---
  @Get('review')
  reviewQueue() {
    return this.admin.listReview();
  }

  @Get('review/:id')
  reviewDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.reviewDetail(id);
  }

  @Post('review/:id/approve')
  approveRoster(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveRoster(id);
  }

  @Post('review/:id/return')
  returnRoster(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRosterDto,
  ) {
    return this.admin.returnRoster(id, dto.note);
  }

  // --- Media ---
  @Get('players/:id/photo/image')
  @Header('Cache-Control', 'no-store')
  async playerPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contentType, buffer } = await this.admin.playerPhoto(id);
    res.set('Content-Type', contentType);
    return new StreamableFile(buffer);
  }

  @Get('credentials/:id/qr')
  @Header('Cache-Control', 'no-store')
  async credentialQr(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.admin.credentialToken(id);
    res.set('Content-Type', 'image/png');
    return new StreamableFile(await qrPng(token));
  }
}
