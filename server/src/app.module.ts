import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './common/storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { LessonsModule } from './lessons/lessons.module';
import { DocumentsModule } from './documents/documents.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    DocumentsModule,
    EnrollmentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
