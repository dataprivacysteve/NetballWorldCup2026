import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
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
  @AllowUnapproved()
  update(
    @Body() dto: UpdateDelegationDto,
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.delegation.update(dto, req.user.userId);
  }

  @Post('registration/submit')
  @AllowUnapproved()
  submitRegistration(@Req() req: Request & { user: { userId: string } }) {
    return this.delegation.submitRegistration(req.user.userId);
  }

  @Post('submit')
  submit(@Req() req: Request & { user: { userId: string } }) {
    return this.delegation.submit(req.user.userId);
  }

  @Post('submit-partial')
  submitPartial(@Req() req: Request & { user: { userId: string } }) {
    return this.delegation.submitPartial(req.user.userId);
  }
}
