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
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, LocOfficerGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';
import {
  ReturnRosterDto,
  RejectRegistrationDto,
  ScanDto,
  SetWindowDto,
  VerifyIdentityDto,
  RevokeCredentialDto,
  SyncOfflineScansDto,
} from './admin.dto';
import { qrPng } from './qr.util';

// Stopgap OC console endpoints. Admin-only; not tenant-scoped — acts across
// delegations via the privileged pool.
@Controller('admin')
@UseGuards(AuthGuard, LocOfficerGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Registration approval ---
  @Get('delegations')
  pendingRegistrations() {
    return this.admin.listPendingRegistrations();
  }

  @Get('registrations')
  registrations() {
    return this.admin.listRegistrations();
  }

  @Post('delegations/:id/approve')
  approveRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.approveRegistration(id, req.user.userId);
  }

  @Post('delegations/:id/reject')
  rejectRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.admin.rejectRegistration(id, req.user.userId, dto.reason);
  }

  // --- Registration window (cutoff) ---
  @Get('registration-window')
  registrationWindow() {
    return this.admin.getRegistrationWindow();
  }

  @Patch('registration-window')
  setRegistrationWindow(
    @Body() dto: SetWindowDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.setRegistrationWindow(
      dto.closesAt ? new Date(dto.closesAt) : null,
      req.user.userId,
    );
  }

  // --- Badges + gate scan ---
  @Get('accredited')
  accredited() {
    return this.admin.listAccredited();
  }

  @Post('scan/verify')
  scanVerify(
    @Body() dto: ScanDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.verifyScan(dto.token, req.user.userId);
  }

  @Get('scan/offline-bundle')
  offlineBundle() {
    return this.admin.offlineGateBundle();
  }

  @Post('scan/sync')
  syncOfflineScans(
    @Body() dto: SyncOfflineScansDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.syncOfflineScans(dto.events, req.user.userId);
  }

  @Get('scan/history')
  scanHistory() {
    return this.admin.gateHistory();
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
  approveRoster(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.approveRoster(id, req.user.userId);
  }

  @Post('review/:id/people/:playerId/verify')
  verifyPerson(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.reviewPerson(id, playerId, 'verified', req.user.userId);
  }

  @Post('review/:id/people/:playerId/return')
  returnPerson(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body() dto: ReturnRosterDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.reviewPerson(
      id,
      playerId,
      'returned',
      req.user.userId,
      dto.note,
    );
  }

  @Post('review/:id/return')
  returnRoster(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnRosterDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.returnRoster(id, dto.note, req.user.userId);
  }

  @Get('audit')
  auditHistory() {
    return this.admin.auditHistory();
  }

  @Get('exports/nwc-submission.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async exportNwcSubmission(
    @Req() req: Request & { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const exportFile = await this.admin.exportNwcSubmission(req.user.userId);
    res.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.set(
      'Content-Disposition',
      `attachment; filename="${exportFile.filename}"`,
    );
    res.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(exportFile.buffer);
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

  @Get('players/:id/identity/document')
  @Header('Cache-Control', 'no-store')
  async identityDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contentType, buffer } = await this.admin.identityDocument(
      id,
      req.user.userId,
    );
    res.set('Content-Type', contentType);
    res.set('Content-Disposition', 'inline');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "sandbox; default-src 'none'");
    return new StreamableFile(buffer);
  }

  @Post('players/:id/identity/verify')
  verifyIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: VerifyIdentityDto,
  ) {
    return this.admin.verifyIdentity(
      id,
      dto.documentId,
      req.user.userId,
      dto.status,
      dto.note,
    );
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

  @Post('credentials/:id/revoke')
  revokeCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeCredentialDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.revokeCredential(id, req.user.userId, dto.reason);
  }

  @Post('credentials/:id/reissue')
  reissueCredential(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.reissueCredential(id, req.user.userId);
  }
}
