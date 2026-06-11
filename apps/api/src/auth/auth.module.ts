import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard, AdminGuard } from './auth.guard';

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
  providers: [AuthService, AuthGuard, AdminGuard],
  // Export JwtModule too so other modules (admin credential issuance) can sign
  // tokens with the same configured secret.
  exports: [AuthService, AuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
