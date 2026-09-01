import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ControlController } from './control.controller';
import { ControlService } from './control.service';

@Module({
  imports: [AdminModule],
  controllers: [ControlController],
  providers: [ControlService],
})
export class ControlModule {}
