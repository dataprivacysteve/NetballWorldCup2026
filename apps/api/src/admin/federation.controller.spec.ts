import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { FederationController } from './federation.controller';

describe('FederationController read-only boundary', () => {
  it('exposes exactly four GET handlers', () => {
    const prototype = FederationController.prototype as unknown as Record<
      string,
      unknown
    >;
    const methods = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => prototype[name])
      .filter(
        (method): method is (...args: unknown[]) => unknown =>
          method instanceof Function,
      );

    expect(methods).toHaveLength(4);
    for (const method of methods) {
      expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(
        RequestMethod.GET,
      );
    }
  });
});
