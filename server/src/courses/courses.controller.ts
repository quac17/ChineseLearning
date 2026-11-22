import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/types/domain.types';
import { CoursesService } from './courses.service';
import { CreateCourseDto, ReorderCoursesDto, SetCoursePriceDto, UpdateCourseDto } from './dto/course.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query('module') moduleFilter: string | undefined,
    @Query('q') search: string | undefined,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.coursesService.findAll(moduleFilter, search, user);
  }

  @Get('manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  findManageable(@CurrentUser() user: AuthUser) {
    return this.coursesService.findManageable(user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser | null) {
    return this.coursesService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  create(@Body() dto: CreateCourseDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.create(dto, user);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  reorder(@Body() dto: ReorderCoursesDto, @CurrentUser() user: AuthUser) {
    return this.coursesService.reorder(dto.orderedIds, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.coursesService.update(id, dto, user);
  }

  /** Prices are set by admins only; teachers can read them but not change them. */
  @Patch(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  setPrice(@Param('id') id: string, @Body() dto: SetCoursePriceDto) {
    return this.coursesService.setPrice(id, dto.priceVnd);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.coursesService.remove(id, user);
  }
}
