import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
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
    private readonly passwordResets: PasswordResetService,
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

  /**
   * Public: the learner is logged out. Same answer whether the email exists
   * or not; rate limited per account and per IP (PasswordResetService).
   */
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.passwordResets.requestReset(dto.email, req.ip ?? null);
  }

  /** Public: the token from the mailed link is the credential. */
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResets.resetPassword(dto.token, dto.password);
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
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Other sessions are logged out; this one gets a new cookie.
    const { accessToken, result } = await this.authService.changePassword(user.id, dto);
    this.setAuthCookie(res, accessToken);
    return result;
  }
}
