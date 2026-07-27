import { Module } from '@nestjs/common';
import { GameDayController } from './gameday.controller';
import { GameDayService } from './gameday.service';

@Module({
  controllers: [GameDayController],
  providers: [GameDayService],
  exports: [GameDayService],
})
export class GameDayModule {}
