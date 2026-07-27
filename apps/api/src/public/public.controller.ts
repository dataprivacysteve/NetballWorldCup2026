import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
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
}
