import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantInterceptor } from '../tenant/tenant.interceptor';
import { PlayerService } from './player.service';
import { PhotoService } from './photo.service';
import { CreateConsentDto, CreatePlayerDto, UpdatePlayerDto } from './dto';

// Tenant-scoped roster, consent, and photo intake. TenantInterceptor wraps
// every route in the RLS transaction; FileInterceptor (for photo) composes
// fine — the upload handler still runs inside that transaction.
@Controller('players')
@UseInterceptors(TenantInterceptor)
export class PlayerController {
  constructor(
    private readonly players: PlayerService,
    private readonly photos: PhotoService,
  ) {}

  @Get()
  list() {
    return this.players.list();
  }

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.players.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerDto,
  ) {
    return this.players.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.players.remove(id);
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

  @Get(':id/photos')
  listPhotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.players.listPhotos(id);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.photos.upload(id, file);
  }
}
