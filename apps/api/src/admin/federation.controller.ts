import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, FederationViewerGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';

// Read-only competition-owner surface. There are intentionally no POST,
// PATCH, PUT or DELETE handlers in this controller.
@Controller('federation')
@UseGuards(AuthGuard, FederationViewerGuard)
export class FederationController {
  constructor(private readonly admin: AdminService) {}

  @Get('delegations')
  delegations() {
    return this.admin.listFederationRegistrations();
  }

  @Get('delegations/:id')
  delegation(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.federationReviewDetail(id, req.user.userId);
  }

  @Get('players/:id/photo/image')
  @Header('Cache-Control', 'private, no-store')
  async playerPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contentType, buffer } = await this.admin.playerPhoto(id);
    res.set('Content-Type', contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(buffer);
  }

  @Get('players/:id/identity/document')
  @Header('Cache-Control', 'private, no-store')
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
}
