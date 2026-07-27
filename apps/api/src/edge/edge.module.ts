import { Module } from '@nestjs/common';
import { EdgeController } from './edge.controller';
import { EdgeGuard } from './edge.guard';
import { EdgeService } from './edge.service';

@Module({
  controllers: [EdgeController],
  providers: [EdgeService, EdgeGuard],
})
export class EdgeModule {}
