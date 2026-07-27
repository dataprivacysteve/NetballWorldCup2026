import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PublicService } from './public.service';

const NO_STORE = 'no-store, max-age=0';

function escapeXml(value: unknown) {
  const safe =
    value === null || value === undefined
      ? ''
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ? `${value}`
        : '';
  return safe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function feedXml(feed: Record<string, unknown>) {
  const fields = Object.entries(feed)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gameday><match>${fields}</match></gameday>`;
}

// Root aliases preserve the simple vMix data-source URL. The public-prefixed
// JSON routes remain available for the website and other read-only consumers.
@Controller()
export class BroadcastController {
  constructor(private readonly publicService: PublicService) {}

  @Get(['live.json', 'public/broadcast/live.json'])
  @Header('Cache-Control', NO_STORE)
  async liveJson() {
    const feed = await this.publicService.liveBroadcast();
    if (!feed) throw new NotFoundException('No broadcast match is available');
    return feed;
  }

  @Get(['live.xml', 'public/broadcast/live.xml'])
  @Header('Cache-Control', NO_STORE)
  async liveXml(@Res() response: Response) {
    const feed = await this.publicService.liveBroadcast();
    if (!feed) throw new NotFoundException('No broadcast match is available');
    response.type('application/xml').send(feedXml(feed));
  }

  @Get('public/broadcast/matches/:id/live.json')
  @Header('Cache-Control', NO_STORE)
  async matchJson(@Param('id') id: string) {
    const feed = await this.publicService.liveBroadcast(id);
    if (!feed) throw new NotFoundException('Broadcast match not found');
    return feed;
  }

  @Get('public/broadcast/matches/:id/live.xml')
  @Header('Cache-Control', NO_STORE)
  async matchXml(@Param('id') id: string, @Res() response: Response) {
    const feed = await this.publicService.liveBroadcast(id);
    if (!feed) throw new NotFoundException('Broadcast match not found');
    response.type('application/xml').send(feedXml(feed));
  }
}
