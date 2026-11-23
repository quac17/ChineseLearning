import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProgramsService } from './programs.service';

describe('ProgramsService', () => {
  let service: ProgramsService;
  let db: any;

  beforeEach(() => {
    db = {
      query: jest.fn(),
      queryOne: jest.fn(),
      queryAll: jest.fn(),
    };
    service = new ProgramsService(db);
  });

  it('lists programs with course counts', async () => {
    db.queryAll.mockResolvedValue([
      {
        code: 'hsk',
        name: 'HSK',
        han: '考',
        card_desc: 'Lộ trình HSK',
        description: 'Mô tả',
        color_1: '#0f7c90',
        color_2: '#b58a2e',
        sort_order: 3,
        course_count: 2,
      },
    ]);

    const res = await service.findAll();
    expect(res).toEqual([
      {
        code: 'hsk',
        name: 'HSK',
        han: '考',
        cardDesc: 'Lộ trình HSK',
        description: 'Mô tả',
        color1: '#0f7c90',
        color2: '#b58a2e',
        sortOrder: 3,
        courseCount: 2,
      },
    ]);
  });

  it('rejects duplicate program code on create', async () => {
    db.queryOne.mockResolvedValueOnce({ code: 'hsk' });
    await expect(
      service.create({
        code: 'hsk',
        name: 'HSK',
        han: '考',
        color1: '#0f7c90',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a new program with auto sortOrder when omitted', async () => {
    db.queryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ max_order: 4 })
      .mockResolvedValueOnce({
        code: 'tocfl',
        name: 'TOCFL',
        han: '華',
        card_desc: 'Chứng chỉ Đài Loan',
        description: null,
        color_1: '#7c3aed',
        color_2: '#7c3aed',
        sort_order: 5,
      });

    const created = await service.create({
      code: 'tocfl',
      name: 'TOCFL',
      han: '華',
      cardDesc: 'Chứng chỉ Đài Loan',
      color1: '#7c3aed',
    });

    expect(created.code).toBe('tocfl');
    expect(created.sortOrder).toBe(5);
    expect(created.courseCount).toBe(0);
  });

  it('throws NotFoundException when updating missing program', async () => {
    db.queryOne.mockResolvedValueOnce(null);
    await expect(service.update('missing', { name: 'New' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a program that still has courses', async () => {
    db.queryOne.mockResolvedValueOnce({ code: 'hsk' }).mockResolvedValueOnce({ cnt: 3 });
    await expect(service.remove('hsk')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('deletes an unused program', async () => {
    db.queryOne.mockResolvedValueOnce({ code: 'tocfl' }).mockResolvedValueOnce({ cnt: 0 });
    db.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await service.remove('tocfl');
    expect(res).toEqual({ deleted: true, code: 'tocfl' });
    expect(db.query).toHaveBeenCalledWith('DELETE FROM program_modules WHERE code = $1', ['tocfl']);
  });
});
