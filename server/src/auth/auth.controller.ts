import { Body, Controller, Get, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.cookieName = configService.get<string>('COOKIE_NAME') || 'vankinh_token';
    this.cookieSecure = configService.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = (configService.get<string>('COOKIE_SAME_SITE') || 'lax').toLowerCase();
    this.cookieSameSite =
      sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax';
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: '/',
    });
    return { loggedOut: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
