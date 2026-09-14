import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCommunicationsController } from './admin-communications.controller';
import { AdminService } from './admin.service';
import { MatchAdminController } from './match-admin.controller';
import { MatchAdminService } from './match-admin.service';
import { FederationController } from './federation.controller';

@Module({
  controllers: [
    AdminController,
    AdminCommunicationsController,
    MatchAdminController,
    FederationController,
  ],
  providers: [AdminService, MatchAdminService],
  exports: [MatchAdminService],
})
export class AdminModule {}
