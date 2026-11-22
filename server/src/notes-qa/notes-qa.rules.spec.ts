import { AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/types/domain.types';
import { canAnswer, canRemoveAnswer, canRemoveQuestion, normalizeBody } from './notes-qa.rules';

const user = (id: string, role: Role): AuthUser => ({ id, role, email: `${id}@e.test`, fullName: id, phone: null, bio: null });
const owner = user('t1', Role.TEACHER);
const otherTeacher = user('t2', Role.TEACHER);
const admin = user('a1', Role.ADMIN);
const asker = user('s1', Role.STUDENT);
const classmate = user('s2', Role.STUDENT);

describe('canAnswer', () => {
  it('the course teacher and admins answer', () => {
    expect(canAnswer(owner, 't1')).toBe(true);
    expect(canAnswer(admin, 't1')).toBe(true);
    expect(canAnswer(admin, null)).toBe(true);
  });

  it('another teacher, students and teacherless courses do not', () => {
    expect(canAnswer(otherTeacher, 't1')).toBe(false);
    expect(canAnswer(asker, 't1')).toBe(false);
    expect(canAnswer(owner, null)).toBe(false);
    // A student whose id happens to equal the teacher id still is not a teacher.
    expect(canAnswer(user('t1', Role.STUDENT), 't1')).toBe(false);
  });
});

describe('canRemoveQuestion', () => {
  const q = { user_id: 's1' };
  it('the asker, the course teacher and admins may remove it', () => {
    expect(canRemoveQuestion(asker, q, 't1')).toBe(true);
    expect(canRemoveQuestion(owner, q, 't1')).toBe(true);
    expect(canRemoveQuestion(admin, q, 't1')).toBe(true);
  });
  it('classmates and other teachers may not', () => {
    expect(canRemoveQuestion(classmate, q, 't1')).toBe(false);
    expect(canRemoveQuestion(otherTeacher, q, 't1')).toBe(false);
  });
});

describe('canRemoveAnswer', () => {
  it('only its author or an admin', () => {
    const a = { user_id: 't1' };
    expect(canRemoveAnswer(owner, a)).toBe(true);
    expect(canRemoveAnswer(admin, a)).toBe(true);
    expect(canRemoveAnswer(otherTeacher, a)).toBe(false);
    expect(canRemoveAnswer(asker, a)).toBe(false);
  });
});

describe('normalizeBody', () => {
  it('trims and unifies line breaks', () => {
    expect(normalizeBody('  xin chào\r\nbạn  ')).toBe('xin chào\nbạn');
    expect(normalizeBody('   ')).toBe('');
  });
  it('leaves non-text for the validator to reject', () => {
    expect(normalizeBody(42)).toBe(42);
  });
});
