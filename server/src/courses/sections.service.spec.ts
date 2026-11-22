import { isSameIdSet } from './sections.service';

describe('isSameIdSet (section reorder)', () => {
  it('accepts every existing id exactly once, in any order', () => {
    expect(isSameIdSet(['b', 'a', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it.each([
    ['a missing id', ['a', 'b'], ['a', 'b', 'c']],
    ['an id of another course', ['a', 'b', 'x'], ['a', 'b', 'c']],
    ['a duplicate', ['a', 'a', 'b'], ['a', 'b', 'c']],
    ['an extra id', ['a', 'b', 'c', 'd'], ['a', 'b', 'c']],
  ])('rejects %s', (_, ids, existing) => {
    expect(isSameIdSet(ids, existing)).toBe(false);
  });
});
