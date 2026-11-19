import * as crypto from 'crypto';

export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
}

export enum ProgramModule {
  easy = 'easy',
  yct = 'yct',
  hsk = 'hsk',
  talk = 'talk',
}

export enum VideoSourceType {
  UPLOAD = 'UPLOAD',
  YOUTUBE = 'YOUTUBE',
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
}
