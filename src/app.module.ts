import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
        ThrottlerModule.forRoot({ 
              throttlers: [{  ttl:60000, limit:30 }]
         }),
      ConfigModule.forRoot({
           isGlobal: true,
      }),
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'auth',
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard},
    AppService],
})
export class AppModule {}
