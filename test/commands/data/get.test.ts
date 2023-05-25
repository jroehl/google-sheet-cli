import { expect } from '@oclif/test';
import { RAW_DATA, testRun, DATA_GET as worksheetTitle } from '../helper';

const baseCommand = 'data:get';

describe(baseCommand, () => {
  testRun([baseCommand], { worksheetTitle }, (stdout: string) => {
    expect(stdout).to.contain('(a)');
    expect(stdout).to.contain('(b)');
    expect(stdout).to.contain('(c)');
    expect(stdout).to.contain('A1');
    expect(stdout).to.contain('B2');
    expect(stdout).to.contain('C3');
  });

  testRun([baseCommand, '--rawOutput'], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:get',
      rawData: RAW_DATA,
      formatted: [
        {
          '(A)': 'A1',
          '(B)': 'B1',
          '(C)': 'C1',
        },
        {
          '(A)': '',
          '(B)': 'B2',
          '(C)': 'C2',
        },
        {
          '(A)': 'A3',
          '(B)': '',
          '(C)': 'C3',
        },
        {
          '(A)': 'A4',
          '(B)': 'B4',
          '(C)': '',
        },
        {
          '(A)': 'A5',
          '(B)': '',
          '(C)': 'C5',
        },
        {
          '(A)': '',
          '(B)': 'B6',
          '(C)': 'C6',
        },
        {
          '(A)': 'A7',
          '(B)': 'B7',
          '(C)': 'C7',
        },
      ],
      header: ['(A)', '(B)', '(C)'],
      range: `${worksheetTitle}!A1:Z1000`,
    });
  });

  testRun([baseCommand, '--rawOutput', '--hasHeaderRow'], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:get',
      rawData: [
        ['', 'B2', 'C2'],
        ['A3', '', 'C3'],
        ['A4', 'B4', ''],
        ['A5', '', 'C5'],
        ['', 'B6', 'C6'],
        ['A7', 'B7', 'C7'],
      ],
      formatted: [
        {
          A1: '',
          B1: 'B2',
          C1: 'C2',
        },
        {
          A1: 'A3',
          B1: '',
          C1: 'C3',
        },
        {
          A1: 'A4',
          B1: 'B4',
          C1: '',
        },
        {
          A1: 'A5',
          B1: '',
          C1: 'C5',
        },
        {
          A1: '',
          B1: 'B6',
          C1: 'C6',
        },
        {
          A1: 'A7',
          B1: 'B7',
          C1: 'C7',
        },
      ],
      header: ['A1', 'B1', 'C1'],
      range: `${worksheetTitle}!A1:Z1000`,
    });
  });

  testRun([baseCommand, '--rawOutput', '--hasHeaderRow', '--minCol=2', '--minRow=2', '--maxCol=2', '--maxRow=2'], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:get',
      rawData: [['B2']],
      formatted: [
        {
          B1: 'B2',
        },
      ],
      header: ['B1'],
      range: `${worksheetTitle}!B2`,
    });
  });

  testRun([baseCommand, '--rawOutput', '--hasHeaderRow', `--range='${worksheetTitle}'!C3`], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:get',
      rawData: [['C3']],
      formatted: [
        {
          C1: 'C3',
        },
      ],
      header: ['C1'],
      range: `${worksheetTitle}!C3`,
    });
  });

  testRun([baseCommand, '--rawOutput', '--hasHeaderRow', `--range='${worksheetTitle}'!A2`], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:get',
      rawData: [],
      formatted: [],
      header: ['A1'],
      range: `${worksheetTitle}!A2`,
    });
  });
});
