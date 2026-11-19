import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../types/domain.types';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  bio: string | null;
  role: Role;
  createdAt?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.user ?? null;
  },
);
