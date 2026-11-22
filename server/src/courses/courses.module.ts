import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';

@Module({
  controllers: [CoursesController, SectionsController],
  providers: [CoursesService, SectionsService],
  exports: [CoursesService, SectionsService],
})
export class CoursesModule {}
