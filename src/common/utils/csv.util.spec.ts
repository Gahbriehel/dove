import { buildCsv, csvFilename } from './csv.util';

const BOM = '﻿';

describe('buildCsv', () => {
  it('renders a header row and one row per record', () => {
    const csv = buildCsv(
      [{ id: '1', name: 'Alice' }],
      [
        { header: 'ID', value: (r) => r.id },
        { header: 'Name', value: (r) => r.name },
      ],
    );

    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines).toEqual(['ID,Name', '1,Alice']);
  });

  it('quotes and escapes fields containing commas, quotes, or newlines', () => {
    const csv = buildCsv(
      [{ note: 'has "quotes", a comma, and\na newline' }],
      [{ header: 'Note', value: (r) => r.note }],
    );

    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines[1]).toBe('"has ""quotes"", a comma, and\na newline"');
  });

  it('renders null and undefined values as empty fields', () => {
    const csv = buildCsv(
      [{ a: null, b: undefined }],
      [
        { header: 'A', value: (r) => r.a },
        { header: 'B', value: (r) => r.b },
      ],
    );

    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines[1]).toBe(',');
  });

  it('serializes Date values as ISO strings', () => {
    const date = new Date('2026-01-15T10:00:00.000Z');
    const csv = buildCsv(
      [{ createdAt: date }],
      [{ header: 'Created At', value: (r) => r.createdAt }],
    );

    const lines = csv.replace(BOM, '').split('\r\n');
    expect(lines[1]).toBe('2026-01-15T10:00:00.000Z');
  });

  it('prefixes the output with a UTF-8 BOM for Excel compatibility', () => {
    const csv = buildCsv([], [{ header: 'A', value: () => '' }]);
    expect(csv.startsWith(BOM)).toBe(true);
  });
});

describe('csvFilename', () => {
  it("appends today's date and a .csv extension to the base name", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(csvFilename('people')).toBe(`people-${today}.csv`);
  });
});
