import type { Response } from 'express';

/** Safety cap on rows fetched for a single CSV export to avoid unbounded memory use. */
export const CSV_EXPORT_MAX_ROWS = 10000;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

function stringifyCsvValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = stringifyCsvValue(value);
  if (/["\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const BOM = '﻿';

/** Serializes rows into an Excel-friendly CSV string (UTF-8 BOM, CRLF line endings). */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(c.value(row))).join(','),
  );
  return [BOM + header, ...lines].join('\r\n');
}

/** Builds a date-stamped download filename, e.g. `people-2026-09-22.csv`. */
export function csvFilename(baseName: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName}-${date}.csv`;
}

/** Writes a CSV string directly to the response as a file attachment. */
export function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}
