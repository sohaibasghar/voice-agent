import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DomainModule } from './domain/domain.module';
import { PrismaModule } from './prisma/prisma.module';
import { CalendarModule } from './calendar/calendar.module';
import { SessionModule } from './session/session.module';
import { HealthModule } from './health/health.module';
import { SeedModule } from './seed/seed.module';
import { ToolsModule } from './tools/tools.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DomainModule,
    PrismaModule,
    CalendarModule,
    SessionModule,
    HealthModule,
    SeedModule,
    ToolsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
