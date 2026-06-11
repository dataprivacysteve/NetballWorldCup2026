import type { Response } from 'express';
import type { ConfigService } from '@nestjs/config';

// httpOnly session cookie scoped to COOKIE_DOMAIN (e.g. .netballamericas.test)
// so it travels from the teams subdomain to the api subdomain. Secure: served
// over local HTTPS via Caddy and real TLS in production.
export const SESSION_COOKIE = 'gameday_session';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

export function setSessionCookie(
  res: Response,
  token: string,
  config: ConfigService,
) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: config.get<string>('COOKIE_DOMAIN'),
    path: '/',
    maxAge: TWELVE_HOURS,
  });
}

export function clearSessionCookie(res: Response, config: ConfigService) {
  res.clearCookie(SESSION_COOKIE, {
    domain: config.get<string>('COOKIE_DOMAIN'),
    path: '/',
  });
}
