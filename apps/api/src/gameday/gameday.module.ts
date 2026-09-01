import { Module } from '@nestjs/common';
import { GameDayController } from './gameday.controller';
import { StatsController } from './stats.controller';
import { GameDayService } from './gameday.service';

@Module({
  controllers: [GameDayController, StatsController],
  providers: [GameDayService],
  exports: [GameDayService],
})
export class GameDayModule {}
