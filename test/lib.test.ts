import { expect } from '@oclif/test';
import { aToCol, colToA, getLongestArray, getRange, parseRange } from '../src/lib/utils';

describe('lib', () => {
  it('getLongestArray', async () => {
    const res = getLongestArray([
      ['a', 'b', 'c'],
      ['a', 'b'],
      ['a', 'b', 'c', 'd'],
    ]);
    expect(res).to.eql({ array: ['a', 'b', 'c', 'd'], index: 2, length: 4 });
  });

  it('colToA & aToCol', async () => {
    for (let i = 1; i <= 5000; i++) {
      const a1 = colToA(i);
      const col = aToCol(a1);
      expect(col).to.equal(i);
    }
  });

  describe('getRange', () => {
    it('range', async () => {
      const res = getRange({ range: '"foo"!B1:C2' });
      expect(res).to.equal('"foo"!B1:C2');
    });

    it('title', async () => {
      const res = getRange({ worksheetTitle: 'foo' });
      expect(res).to.equal("'foo'");
    });

    it('minCol & minRow', async () => {
      const res = getRange({ worksheetTitle: 'foo', minCol: 1, minRow: 1 });
      expect(res).to.equal("'foo'!A1");
    });

    it('minCol & minRow & maxCol & maxRow', async () => {
      const res = getRange({ worksheetTitle: 'foo', minCol: 1, minRow: 1, maxCol: 2, maxRow: 2 });
      expect(res).to.equal("'foo'!A1:B2");
    });
  });

  describe('parseRanges', () => {
    it('minCol & minRow & maxCol & maxRow & worksheettitle', async () => {
      const res = parseRange('"foo"!B1:C2');
      expect(res).to.eql({ maxCol: 3, maxRow: 2, minCol: 2, minRow: 1, worksheetTitle: 'foo' });
    });

    it('minCol & maxCol & worksheettitle', async () => {
      const res = parseRange('"foo"!B1');
      expect(res).to.eql({ maxCol: 2, maxRow: 1, minCol: 2, minRow: 1, worksheetTitle: 'foo' });
    });

    it('minCol & maxCol', async () => {
      const res = parseRange('B1');
      expect(res).to.eql({ maxCol: 2, maxRow: 1, minCol: 2, minRow: 1, worksheetTitle: undefined });
    });

    it('minCol & minRow & maxCol & maxRow', async () => {
      const res = parseRange('B1:C2');
      expect(res).to.eql({ maxCol: 3, maxRow: 2, minCol: 2, minRow: 1, worksheetTitle: undefined });
    });

    it('invalid range', async () => {
      expect(() => parseRange('"foo"')).to.throw('Invalid range ""foo""');
    });
  });
});
