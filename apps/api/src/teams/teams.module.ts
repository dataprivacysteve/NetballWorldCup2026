import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { DelegationController } from './delegation.controller';
import { PlayerController } from './player.controller';
import { RegistrationService } from './registration.service';
import { DelegationService } from './delegation.service';
import { PlayerService } from './player.service';
import { PhotoService } from './photo.service';
import { TenantInterceptor } from '../tenant/tenant.interceptor';

// Module 1 — the teams surface: registration, roster, consent, photo intake,
// and recoverable submission. Tenant isolation is enforced by RLS via the
// TenantInterceptor (see tenant/).
@Module({
  controllers: [
    RegistrationController,
    DelegationController,
    PlayerController,
  ],
  providers: [
    RegistrationService,
    DelegationService,
    PlayerService,
    PhotoService,
    TenantInterceptor,
  ],
})
export class TeamsModule {}
