import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AdminGuard } from '../auth/auth.guard';
import { AdminService } from './admin.service';

// Stopgap OC approver endpoints. Admin-only (seeded is_admin user). Not
// tenant-scoped — acts across delegations via the privileged pool.
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('delegations')
  pending() {
    return this.admin.listPending();
  }

  @Post('delegations/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approve(id);
  }

  @Post('delegations/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.reject(id);
  }
}
