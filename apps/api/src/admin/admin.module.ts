import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MatchAdminController } from './match-admin.controller';
import { MatchAdminService } from './match-admin.service';
import { FederationController } from './federation.controller';
import { FederationService } from './federation.service';

@Module({
  controllers: [AdminController, MatchAdminController, FederationController],
  providers: [AdminService, MatchAdminService, FederationService],
})
export class AdminModule {}
