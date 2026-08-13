import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TablerosModule } from './tableros/tableros.module';
import { NotasModule } from './notas/notas.module';
import { ContactsModule } from './contacts/contacts.module';
import { WidgetModule } from './widget/widget.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { HealthController } from './health/health.controller';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    UsersModule,
    TablerosModule,
    NotasModule,
    ContactsModule,
    WidgetModule,
    AuthModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
