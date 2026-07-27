import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { Request } from 'express';
import { TenantInterceptor } from '../tenant/tenant.interceptor';
import { AuthGuard } from '../auth/auth.guard';
import { PlayerService } from './player.service';
import { PhotoService } from './photo.service';
import { IdentityService } from './identity.service';
import {
  CreateConsentDto,
  CreatePlayerDto,
  IdentityUploadDto,
  UpdatePlayerDto,
} from './dto';

// Tenant-scoped roster, consent, and photo intake. TenantInterceptor wraps
// every route in the RLS transaction; FileInterceptor (for photo) composes
// fine — the upload handler still runs inside that transaction.
@Controller('players')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class PlayerController {
  constructor(
    private readonly players: PlayerService,
    private readonly photos: PhotoService,
    private readonly identity: IdentityService,
  ) {}

  @Get()
  list() {
    return this.players.list();
  }

  @Post()
  create(
    @Body() dto: CreatePlayerDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.players.create(dto, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.players.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.photos.deleteForPlayer(id);
    await this.identity.deleteObjectForPlayer(id);
    return this.players.remove(id, req.user.userId);
  }

  @Get(':id/consents')
  listConsents(@Param('id', ParseUUIDPipe) id: string) {
    return this.players.listConsents(id);
  }

  @Post(':id/consents')
  addConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConsentDto,
  ) {
    return this.players.addConsent(id, dto);
  }

  @Delete(':id/consents/:consentId')
  removeConsent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('consentId', ParseUUIDPipe) consentId: string,
  ) {
    return this.players.removeConsent(id, consentId);
  }

  @Get(':id/photos')
  listPhotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.players.listPhotos(id);
  }

  // Serves the player's latest photo bytes (so the UI can display the headshot).
  @Get(':id/photo/image')
  @Header('Cache-Control', 'no-store')
  async photoImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { contentType, buffer } = await this.photos.getLatestImage(id);
    res.set('Content-Type', contentType);
    return new StreamableFile(buffer);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.photos.upload(id, file);
  }

  @Get(':id/identity')
  identityStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.identity.status(id);
  }

  @Post(':id/identity')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_000_000 } }),
  )
  uploadIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IdentityUploadDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.identity.upload(id, dto, file);
  }

  // View-only credential QR for the delegation's own person (a read — stays
  // available after the registration cutoff). Printing/use is the OC's role.
  @Get(':id/credential/qr')
  @Header('Cache-Control', 'no-store')
  async credentialQr(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Content-Type', 'image/png');
    return new StreamableFile(await this.players.credentialQr(id));
  }
}
