import { expect } from 'chai';
import { aToCol, colToA, getLongestArray, getRange, parseRange, requiredGrid } from '../src/lib/utils';

describe('lib', () => {
  it('getLongestArray', async () => {
    const res = getLongestArray([
      ['a', 'b', 'c'],
      ['a', 'b'],
      ['a', 'b', 'c', 'd'],
    ]);
    expect(res).to.eql({ array: ['a', 'b', 'c', 'd'], index: 2, length: 4 });
  });

  it('getLongestArray of nothing', async () => {
    expect(getLongestArray([])).to.eql({ array: [], index: -1, length: 0 });
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

    const table: [string, ReturnType<typeof parseRange>][] = [
      ['Sheet1!A1', { worksheetTitle: 'Sheet1', minCol: 1, minRow: 1, maxCol: 1, maxRow: 1 }],
      ['Sheet1!A1:C3', { worksheetTitle: 'Sheet1', minCol: 1, minRow: 1, maxCol: 3, maxRow: 3 }],
      ["'My Sheet'!B2", { worksheetTitle: 'My Sheet', minCol: 2, minRow: 2, maxCol: 2, maxRow: 2 }],
      ['"My Sheet"!B2:D4', { worksheetTitle: 'My Sheet', minCol: 2, minRow: 2, maxCol: 4, maxRow: 4 }],
      ["'O''Brien'!A1", { worksheetTitle: "O'Brien", minCol: 1, minRow: 1, maxCol: 1, maxRow: 1 }],
      ["'Wow! Sheet'!A1", { worksheetTitle: 'Wow! Sheet', minCol: 1, minRow: 1, maxCol: 1, maxRow: 1 }],
      ["'Sheet1'!", { worksheetTitle: 'Sheet1' }],
      // the old parser returned a bare {worksheetTitle: undefined} for these rather than
      // throwing, and parseRange is exported, so they keep doing that
      ['', { worksheetTitle: undefined }],
      ['!', { worksheetTitle: undefined }],
      ['B:B', { worksheetTitle: undefined, minCol: 2, minRow: undefined, maxCol: 2, maxRow: undefined }],
      ['Sheet1!B:D', { worksheetTitle: 'Sheet1', minCol: 2, minRow: undefined, maxCol: 4, maxRow: undefined }],
      ['5:5', { worksheetTitle: undefined, minCol: undefined, minRow: 5, maxCol: undefined, maxRow: 5 }],
      ['Sheet1!2:7', { worksheetTitle: 'Sheet1', minCol: undefined, minRow: 2, maxCol: undefined, maxRow: 7 }],
      ['A1:C', { worksheetTitle: undefined, minCol: 1, minRow: 1, maxCol: 3, maxRow: undefined }],
      ['AA10', { worksheetTitle: undefined, minCol: 27, minRow: 10, maxCol: 27, maxRow: 10 }],
      ['$B$2:$C$3', { worksheetTitle: undefined, minCol: 2, minRow: 2, maxCol: 3, maxRow: 3 }],
    ];

    table.forEach(([range, expected]) => {
      it(`parses ${range}`, async () => {
        expect(parseRange(range)).to.eql(expected);
      });
    });

    ['Sheet1', 'a1', "'unterminated!A1"].forEach((range) => {
      it(`rejects ${JSON.stringify(range)}`, async () => {
        expect(() => parseRange(range)).to.throw(`Invalid range "${range}"`);
      });
    });
  });

  describe('requiredGrid', () => {
    const data = [
      ['a', 'b', 'c'],
      ['d', 'e'],
    ];

    it('defaults to the top left corner', async () => {
      expect(requiredGrid(data)).to.eql({ rows: 2, cols: 3 });
    });

    it('starts at minRow and minCol', async () => {
      expect(requiredGrid(data, { minRow: 5, minCol: 4 })).to.eql({ rows: 6, cols: 6 });
    });

    it('starts at the range for an open ended range', async () => {
      expect(requiredGrid(data, { range: "'Sheet1'!C10" })).to.eql({ rows: 11, cols: 5 });
    });

    it('covers the whole of a bounded range', async () => {
      expect(requiredGrid(data, { range: "'Sheet1'!A1:F20" })).to.eql({ rows: 20, cols: 6 });
    });

    it('covers the whole of a bounded maxRow and maxCol', async () => {
      expect(requiredGrid(data, { minRow: 1, minCol: 1, maxRow: 20, maxCol: 6 })).to.eql({ rows: 20, cols: 6 });
    });

    it('sizes an open ended column range from the data', async () => {
      expect(requiredGrid(data, { range: "'Sheet1'!A1:C" })).to.eql({ rows: 2, cols: 3 });
    });

    it('rejects data that is too tall for the range', async () => {
      expect(() => requiredGrid(data, { range: "'Sheet1'!A1:C1" })).to.throw(`data (2x3) does not fit range 'Sheet1'!A1:C1`);
    });

    it('rejects data that is too wide for the range', async () => {
      expect(() => requiredGrid(data, { range: "'Sheet1'!A1:B5" })).to.throw(`data (2x3) does not fit range 'Sheet1'!A1:B5`);
    });

    it('keeps ragged rows and sizes from the longest one', async () => {
      expect(requiredGrid([['a'], ['b', 'c', 'd', 'e'], ['f', 'g']])).to.eql({ rows: 3, cols: 4 });
    });

    it('rejects empty data', async () => {
      expect(() => requiredGrid([])).to.throw('data has to be a non-empty array of rows');
    });

    it('rejects data that is not nested', async () => {
      expect(() => requiredGrid(<any>['a'])).to.throw('data has to be a non-empty array of rows');
    });
  });
});
