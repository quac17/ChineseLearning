import { BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from './users.service';

function serviceWith(links: { courses: number; orders: number }) {
  const db = {
    queryOne: jest.fn().mockResolvedValue(links),
    query: jest.fn().mockResolvedValue({ rowCount: 1 }),
  };
  return { service: new UsersService(db as unknown as DatabaseService), db };
}

describe('UsersService.remove', () => {
  it('refuses to delete the admin who asks', async () => {
    const { service, db } = serviceWith({ courses: 0, orders: 0 });
    await expect(service.remove('admin-1', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('refuses to delete a teacher who still owns courses', async () => {
    const { service, db } = serviceWith({ courses: 2, orders: 0 });
    await expect(service.remove('teacher-1', 'admin-1')).rejects.toThrow('đang phụ trách 2 khoá học');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('refuses to delete an account that has orders', async () => {
    const { service, db } = serviceWith({ courses: 0, orders: 1 });
    await expect(service.remove('student-1', 'admin-1')).rejects.toThrow('đã có đơn hàng');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('deletes an account with no courses and no orders', async () => {
    const { service, db } = serviceWith({ courses: 0, orders: 0 });
    await expect(service.remove('student-1', 'admin-1')).resolves.toEqual({ deleted: true, id: 'student-1' });
    expect(db.query).toHaveBeenCalledWith('DELETE FROM users WHERE id = $1', ['student-1']);
  });
});
