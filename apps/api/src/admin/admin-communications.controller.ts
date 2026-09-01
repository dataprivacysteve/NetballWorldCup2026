import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthGuard, MediaCommsGuard } from '../auth/auth.guard';
import { SaveAdvertisementDto, SaveNewsArticleDto } from './admin.dto';
import { AdminService } from './admin.service';

// Public communications management is intentionally isolated from the wider
// LOC console. LOC officers retain oversight; media/comms accounts receive
// access only to the routes declared in this controller.
@Controller('admin')
@UseGuards(AuthGuard, MediaCommsGuard)
export class AdminCommunicationsController {
  constructor(private readonly admin: AdminService) {}

  @Get('advertising')
  advertising() {
    return this.admin.listAdvertisements();
  }

  @Post('advertising')
  saveAdvertisement(
    @Body() dto: SaveAdvertisementDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.saveAdvertisement(dto, req.user.userId);
  }

  @Post('advertising/:id/creative/:surface')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_000_000 } }),
  )
  uploadAdvertisementCreative(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('surface') surface: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.uploadAdvertisementCreative(
      id,
      surface,
      file,
      req.user.userId,
    );
  }

  @Delete('advertising/:id')
  deleteAdvertisement(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.deleteAdvertisement(id, req.user.userId);
  }

  @Get('news')
  news() {
    return this.admin.listNewsArticles();
  }

  @Post('news')
  saveNews(
    @Body() dto: SaveNewsArticleDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.saveNewsArticle(dto, req.user.userId);
  }

  @Post('news/:id/image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_000_000 } }),
  )
  uploadNewsImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.uploadNewsImage(id, file, req.user.userId);
  }

  @Delete('news/:id')
  deleteNews(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.admin.deleteNewsArticle(id, req.user.userId);
  }
}
