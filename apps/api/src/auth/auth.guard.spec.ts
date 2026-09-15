import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { FederationViewerGuard } from './auth.guard';

function contextFor(platformRole: string | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { platformRole } }),
    }),
  } as unknown as ExecutionContext;
}

describe('FederationViewerGuard', () => {
  const guard = new FederationViewerGuard();

  it('allows only the federation_viewer role', () => {
    expect(guard.canActivate(contextFor('federation_viewer'))).toBe(true);
  });

  it.each([null, 'loc_officer', 'sportsbb_admin', 'scorer'])(
    'rejects %s',
    (role) => {
      expect(() => guard.canActivate(contextFor(role))).toThrow(
        ForbiddenException,
      );
    },
  );
});
