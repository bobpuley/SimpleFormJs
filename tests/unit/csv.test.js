import { describe, expect, it } from 'vitest';
import { csvToRecords, parseCSV } from '../../src/csv.js';

const fields = [
  { name: 'airportCode', label: 'Airport code' },
  { name: 'cityCode', label: 'City' },
];

describe('parseCSV', () => {
  it('parses quotes, escaped quotes, embedded newlines and CRLF', () => {
    expect(parseCSV('a,"b ""q""","c\nd"\r\n1,2,3\n')).toEqual([
      ['a', 'b "q"', 'c\nd'],
      ['1', '2', '3'],
    ]);
  });

  it('auto-detects ; and tab delimiters and skips blank lines', () => {
    expect(parseCSV('a;b\n\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCSV('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('strips the BOM', () => {
    expect(parseCSV('\uFEFFa,b')).toEqual([['a', 'b']]);
  });
});

describe('csvToRecords', () => {
  it('uses the header when it matches names or labels', () => {
    expect(csvToRecords(parseCSV('City,AIRPORTCODE\nPAR,CDG'), fields)).toEqual([{ cityCode: 'PAR', airportCode: 'CDG' }]);
  });

  it('falls back to schema order without a header', () => {
    expect(csvToRecords(parseCSV('CDG,PAR\nFCO, ROM '), fields)).toEqual([
      { airportCode: 'CDG', cityCode: 'PAR' },
      { airportCode: 'FCO', cityCode: 'ROM' },
    ]);
  });
});
