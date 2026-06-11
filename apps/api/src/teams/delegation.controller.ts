import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { TenantInterceptor } from '../tenant/tenant.interceptor';
import { DelegationService } from './delegation.service';
import { UpdateDelegationDto } from './dto';

// Tenant-scoped: every route requires the x-delegation-id header and runs
// inside the RLS transaction.
@Controller('delegation')
@UseInterceptors(TenantInterceptor)
export class DelegationController {
  constructor(private readonly delegation: DelegationService) {}

  @Get()
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
