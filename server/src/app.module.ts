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
import { PaymentsModule } from './payments/payments.module';
import { ProgressModule } from './progress/progress.module';
import { VocabularyModule } from './vocabulary/vocabulary.module';
import { PracticeModule } from './practice/practice.module';

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
    PaymentsModule,
    ProgressModule,
    VocabularyModule,
    PracticeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
