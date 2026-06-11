import { Body, Controller, Post } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegisterDelegationDto } from './dto';

// NOT tenant-scoped: this is where a delegation first comes into existence.
@Controller('delegations')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post()
  register(@Body() dto: RegisterDelegationDto) {
    return this.registration.register(dto);
  }
}
