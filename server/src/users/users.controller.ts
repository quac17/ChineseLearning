import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/types/domain.types';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('stats')
  @Roles(Role.ADMIN)
  getStats() {
    return this.usersService.getStats();
  }

  @Get('students')
  @Roles(Role.ADMIN, Role.TEACHER)
  findStudents() {
    return this.usersService.findStudents();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.remove(id, user.id);
  }
}
