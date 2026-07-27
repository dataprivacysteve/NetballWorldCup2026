import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class EdgeGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const configured = this.config.get<string>('EDGE_SYNC_SECRET');
    if (!configured) {
      throw new ServiceUnavailableException(
        'Venue synchronization is awaiting production secret configuration',
      );
    }
    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header('x-gameday-edge-key') ?? '';
    const expectedBuffer = Buffer.from(configured);
    const suppliedBuffer = Buffer.from(supplied);
    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      throw new ForbiddenException('Invalid venue synchronization key');
    }
    const nodeId = request.header('x-gameday-edge-node');
    if (!nodeId)
      throw new ForbiddenException('Venue node identity is required');
    return true;
  }
}
