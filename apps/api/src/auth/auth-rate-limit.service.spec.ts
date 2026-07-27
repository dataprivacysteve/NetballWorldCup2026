import { AuthRateLimitService } from './auth-rate-limit.service';

describe('authentication rate limit', () => {
  it('blocks a sixth failed attempt and clears after success', () => {
    const limiter = new AuthRateLimitService();
    const key = '127.0.0.1:user@example.org';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.assertAllowed(key);
      limiter.failure(key);
    }
    expect(() => limiter.assertAllowed(key)).toThrow(
      'Too many sign-in attempts',
    );
    limiter.success(key);
    expect(() => limiter.assertAllowed(key)).not.toThrow();
  });
});
