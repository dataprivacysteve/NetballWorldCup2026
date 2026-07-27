import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { BroadcastController } from './broadcast.controller';

// The unauthenticated public read surface (Module 4). PUBLIC_POOL is provided
// globally by DatabaseModule.
@Module({
  controllers: [PublicController, BroadcastController],
  providers: [PublicService],
})
export class PublicModule {}
