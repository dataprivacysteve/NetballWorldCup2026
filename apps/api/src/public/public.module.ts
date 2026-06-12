import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

// The unauthenticated public read surface (Module 4). PUBLIC_POOL is provided
// globally by DatabaseModule.
@Module({
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
