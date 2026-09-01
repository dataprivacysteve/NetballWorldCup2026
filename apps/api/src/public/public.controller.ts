import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { PublicService } from './public.service';

// Public, unauthenticated read API for the www surface. No guards, no tenant
// context — served by the SELECT-only gameday_public role. Responses are
// cacheable so a CDN can front them (the brief's read-only projection).
const CACHE = 'public, max-age=30, stale-while-revalidate=120';

@Controller('public')
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('tournament')
  @Header('Cache-Control', CACHE)
  tournament() {
    return this.svc.tournament();
  }

  @Get('nations')
  @Header('Cache-Control', CACHE)
  nations() {
    return this.svc.nations();
  }

  @Get('experience')
  @Header('Cache-Control', CACHE)
  experience() {
    return this.svc.experience();
  }

  @Get('site-mode')
  @Header('Cache-Control', 'no-store')
  siteMode() {
    return this.svc.siteMode();
  }

  @Get('gym-display-mode')
  @Header('Cache-Control', 'no-store')
  gymDisplayMode() {
    return this.svc.gymDisplayMode();
  }

  @Get('advertising/:id/:surface')
  @Header('Cache-Control', 'public, max-age=300')
  async advertisingCreative(
    @Param('id') id: string,
    @Param('surface') surface: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const creative = await this.svc.advertisingCreative(id, surface);
    res.set('Content-Type', creative.contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(creative.buffer);
  }

  @Get('news/:id/image')
  @Header('Cache-Control', 'public, max-age=300')
  async newsImage(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const image = await this.svc.newsImage(id);
    res.set('Content-Type', image.contentType);
    res.set('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(image.buffer);
  }

  @Get('news/:slug')
  @Header('Cache-Control', CACHE)
  async newsArticle(@Param('slug') slug: string) {
    const article = await this.svc.newsArticle(slug);
    if (!article) throw new NotFoundException('News article not found');
    return article;
  }

  @Get('nations/:code/squad')
  @Header('Cache-Control', CACHE)
  async squad(@Param('code') code: string) {
    const squad = await this.svc.squad(code.toUpperCase());
    if (!squad) throw new NotFoundException('Unknown nation');
    return squad;
  }

  @Get('fixtures')
  @Header('Cache-Control', CACHE)
  fixtures() {
    return this.svc.fixtures();
  }

  @Get('matches/:id/lineup')
  @Header('Cache-Control', 'no-store')
  async matchLineup(@Param('id', ParseUUIDPipe) id: string) {
    const lineup = await this.svc.matchLineup(id);
    if (!lineup) throw new NotFoundException('Unknown match');
    return lineup;
  }

  @Get('results')
  @Header('Cache-Control', CACHE)
  results() {
    return this.svc.results();
  }

  @Get('standings')
  @Header('Cache-Control', CACHE)
  standings(@Query('stage') stage?: string) {
    return this.svc.standings(stage);
  }

  @Get('last-next')
  @Header('Cache-Control', CACHE)
  lastNext() {
    return this.svc.lastNext();
  }

  @Get('broadcasts')
  @Header('Cache-Control', CACHE)
  broadcasts() {
    return this.svc.broadcasts();
  }

  @Get('analytics/matches/:id')
  @Header('Cache-Control', CACHE)
  async matchAnalytics(@Param('id') id: string) {
    const analytics = await this.svc.matchAnalytics(id);
    if (!analytics) throw new NotFoundException('Unknown match');
    return analytics;
  }

  @Get('analytics/matches/:id/export.csv')
  @Header('Cache-Control', CACHE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async matchAnalyticsCsv(@Param('id') id: string) {
    const csv = await this.svc.matchAnalyticsCsv(id);
    if (!csv) throw new NotFoundException('Unknown match');
    return csv;
  }

  @Get('analytics/matches/:id/report.csv')
  @Header('Cache-Control', CACHE)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async matchReportCsv(@Param('id') id: string) {
    const csv = await this.svc.matchReportCsv(id);
    if (!csv) throw new NotFoundException('Unknown match');
    return csv;
  }

  @Get('analytics/records')
  @Header('Cache-Control', CACHE)
  records() {
    return this.svc.historicalRecords();
  }
}
