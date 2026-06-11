import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TenantInterceptor } from '../tenant/tenant.interceptor';
import { AuthGuard } from '../auth/auth.guard';
import { AllowUnapproved } from '../auth/auth.metadata';
import { DelegationService } from './delegation.service';
import { UpdateDelegationDto } from './dto';

// Tenant-scoped: authenticated (session cookie), runs inside the RLS
// transaction. Roster mutation requires OC approval; reading the delegation is
// allowed while pending so the UI can show the approval state.
@Controller('delegation')
@UseGuards(AuthGuard)
@UseInterceptors(TenantInterceptor)
export class DelegationController {
  constructor(private readonly delegation: DelegationService) {}

  @Get()
  @AllowUnapproved()
  getCurrent() {
    return this.delegation.getCurrent();
  }

  @Patch()
  update(@Body() dto: UpdateDelegationDto) {
    return this.delegation.update(dto);
  }

  @Post('submit')
  submit() {
    return this.delegation.submit();
  }
}
