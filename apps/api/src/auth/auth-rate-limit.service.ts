import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Attempt = { failures: number; blockedUntil: number };

@Injectable()
export class AuthRateLimitService {
  private readonly attempts = new Map<string, Attempt>();
  private readonly maximumFailures = 5;
  private readonly windowMs = 15 * 60 * 1000;

  assertAllowed(key: string) {
    const current = this.attempts.get(key);
    if (!current) return;
    if (current.blockedUntil <= Date.now()) {
      this.attempts.delete(key);
      return;
    }
    if (current.failures >= this.maximumFailures) {
      throw new HttpException(
        'Too many sign-in attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  failure(key: string) {
    const current = this.attempts.get(key);
    const failures = (current?.failures ?? 0) + 1;
    this.attempts.set(key, {
      failures,
      blockedUntil: Date.now() + this.windowMs,
    });
  }

  success(key: string) {
    this.attempts.delete(key);
  }
}
