import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  FederationViewerGuard,
  LocOfficerGuard,
  MediaCommsGuard,
  StatsGuard,
} from './auth.guard';
import type { PlatformRole, SessionUser } from './auth.service';

function contextFor(platformRole: PlatformRole): ExecutionContext {
  const user: SessionUser = {
    userId: '00000000-0000-4000-8000-000000000001',
    delegationId: null,
    isAdmin: true,
    platformRole,
    authVersion: 0,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('MediaCommsGuard', () => {
  const guard = new MediaCommsGuard();

  it('allows a media and communications account', () => {
    expect(guard.canActivate(contextFor('media_comms'))).toBe(true);
  });

  it('allows the LOC officer to retain communications oversight', () => {
    expect(guard.canActivate(contextFor('loc_officer'))).toBe(true);
  });

  it('rejects unrelated platform roles', () => {
    expect(() => guard.canActivate(contextFor('scorer'))).toThrow(
      ForbiddenException,
    );
  });
});

describe('LocOfficerGuard boundary', () => {
  it('does not grant a media and communications account LOC access', () => {
    expect(() =>
      new LocOfficerGuard().canActivate(contextFor('media_comms')),
    ).toThrow(ForbiddenException);
  });

  it('does not grant a federation viewer LOC mutation access', () => {
    expect(() =>
      new LocOfficerGuard().canActivate(contextFor('federation_viewer')),
    ).toThrow(ForbiddenException);
  });
});

describe('FederationViewerGuard boundary', () => {
  const guard = new FederationViewerGuard();

  it('allows the dedicated federation viewer', () => {
    expect(guard.canActivate(contextFor('federation_viewer'))).toBe(true);
  });

  it('does not grant LOC or media accounts federation access', () => {
    expect(() => guard.canActivate(contextFor('loc_officer'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor('media_comms'))).toThrow(
      ForbiddenException,
    );
  });
});

describe('StatsGuard', () => {
  const guard = new StatsGuard();

  it('allows stats recorders and read-only hosts', () => {
    expect(guard.canActivate(contextFor('stats_lineup'))).toBe(true);
    expect(guard.canActivate(contextFor('stats_host'))).toBe(true);
  });

  it('rejects scoring and LOC accounts', () => {
    expect(() => guard.canActivate(contextFor('scorer'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor('loc_officer'))).toThrow(
      ForbiddenException,
    );
  });
});
