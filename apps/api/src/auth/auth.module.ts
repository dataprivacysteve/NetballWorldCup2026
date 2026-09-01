import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {
  AuthGuard,
  AdminGuard,
  GameDayOfficialGuard,
  LocOfficerGuard,
  MediaCommsGuard,
  SportsbbAdminGuard,
  StatsGuard,
} from './auth.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';

// Global so AuthGuard / AdminGuard can be applied by controllers in other
// modules (teams, admin) without re-importing.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('SESSION_SECRET'),
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    AdminGuard,
    GameDayOfficialGuard,
    LocOfficerGuard,
    MediaCommsGuard,
    SportsbbAdminGuard,
    StatsGuard,
    AuthRateLimitService,
  ],
  // Export JwtModule too so other modules (admin credential issuance) can sign
  // tokens with the same configured secret.
  exports: [
    AuthService,
    AuthGuard,
    AdminGuard,
    GameDayOfficialGuard,
    LocOfficerGuard,
    MediaCommsGuard,
    SportsbbAdminGuard,
    StatsGuard,
    JwtModule,
  ],
})
export class AuthModule {}
