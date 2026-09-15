import { categoryLinks } from './category-links';

describe('categoryLinks', () => {
  it('keeps the position a product already has in each category', () => {
    expect(categoryLinks([2, 9], new Map([[2, 8], [9, 3]]), new Map([[2, 8], [9, 5]]))).toEqual([
      { categoryId: 2, position: 8 },
      { categoryId: 9, position: 3 },
    ]);
  });

  it('puts a newly joined category last, or at 0 where nobody has arranged it', () => {
    expect(categoryLinks([2, 4], new Map(), new Map([[2, 8], [4, 0]]))).toEqual([
      { categoryId: 2, position: 9 },
      { categoryId: 4, position: 0 },
    ]);
    expect(categoryLinks([7], new Map(), new Map())).toEqual([{ categoryId: 7, position: 0 }]);
  });

  it('ignores a category listed twice', () => {
    expect(categoryLinks([2, 2], new Map([[2, 1]]), new Map())).toEqual([{ categoryId: 2, position: 1 }]);
  });
});
