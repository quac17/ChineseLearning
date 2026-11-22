import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto, TERMS_REQUIRED_MESSAGE } from './auth.dto';

const base = { fullName: 'Học viên', email: 'hocvien@example.test', password: 'Matkhau@123' };

async function termsErrors(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(RegisterDto, body));
  return errors.filter((e) => e.property === 'acceptTerms');
}

describe('RegisterDto.acceptTerms', () => {
  it('accepts a register that ticked the consent box', async () => {
    expect(await termsErrors({ ...base, acceptTerms: true })).toHaveLength(0);
  });

  it.each([
    ['missing', undefined],
    ['false', false],
    ['the string "true"', 'true'],
    ['1', 1],
  ])('refuses acceptTerms %s with the Vietnamese message', async (_label, value) => {
    const errors = await termsErrors({ ...base, acceptTerms: value });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})).toEqual([TERMS_REQUIRED_MESSAGE]);
  });
});
