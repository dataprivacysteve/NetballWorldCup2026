import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { TeamsModule } from './teams/teams.module';
import { PublicModule } from './public/public.module';
import { ControlModule } from './control/control.module';
import { GameDayModule } from './gameday/gameday.module';
import { EdgeModule } from './edge/edge.module';

@Module({
  imports: [
    // Single source of truth for config is the repo-root .env (the laptop ->
    // server seam). The API dev process runs with cwd = apps/api.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '../../.env')],
    }),
    DatabaseModule,
    AuthModule,
    AdminModule,
    TeamsModule,
    PublicModule,
    ControlModule,
    GameDayModule,
    EdgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
