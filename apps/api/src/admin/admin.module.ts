import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MatchAdminController } from './match-admin.controller';
import { MatchAdminService } from './match-admin.service';

@Module({
  controllers: [AdminController, MatchAdminController],
  providers: [AdminService, MatchAdminService],
})
export class AdminModule {}
