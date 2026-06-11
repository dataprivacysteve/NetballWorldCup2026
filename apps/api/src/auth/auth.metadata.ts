import { SetMetadata } from '@nestjs/common';

// Marks a tenant route that may be used BEFORE the delegation is approved
// (e.g. GET /delegation so the UI can show the "pending approval" state). The
// TenantInterceptor skips the approval gate for these; all other tenant routes
// require registration_status = 'approved'.
export const ALLOW_UNAPPROVED = 'allowUnapproved';
export const AllowUnapproved = () => SetMetadata(ALLOW_UNAPPROVED, true);
