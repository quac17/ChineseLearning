import { Equals, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TERMS_REQUIRED_MESSAGE =
  'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật để tạo tài khoản.';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** The register form's consent box; the account is only created when it is ticked. */
  @Equals(true, { message: TERMS_REQUIRED_MESSAGE })
  acceptTerms: boolean;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(255)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Số điện thoại tối đa 30 ký tự' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Giới thiệu tối đa 1000 ký tự' })
  bio?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6, { message: 'Mật khẩu hiện tại không hợp lệ' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20, { message: 'Đường dẫn đặt lại mật khẩu không hợp lệ' })
  @MaxLength(200, { message: 'Đường dẫn đặt lại mật khẩu không hợp lệ' })
  token: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu mới tối đa 128 ký tự' })
  password: string;
}
