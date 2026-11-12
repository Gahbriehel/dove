/**
 * READ-ONLY report of people who share an email address or phone number.
 *
 *   bun scripts/report-duplicate-contacts.ts
 *   bun scripts/report-duplicate-contacts.ts --csv > duplicates.csv
 *
 * Run this BEFORE adding unique indexes on people(church_id, email) and
 * people(church_id, phone). The index migration fails while any of these
 * groups exist. This script never writes to the database.
 *
 * Matching is done on the normalised value, not the stored one:
 *   - email: trimmed and lower-cased
 *   - phone: converted to E.164, so "0803 456 7890", "+2348034567890" and
 *            "2348034567890" count as the same number
 *
 * Also reported:
 *   - phones that cannot be normalised (they would be rejected by the new rule)
 *   - emails that are blank strings (should be NULL, or the index treats
 *     several blanks as duplicates)
 *
 * For each group the first row is the suggested record to KEEP: the one that
 * can already sign in (has a PIN), then the one with the most registrations,
 * then the oldest. This is only a hint. Merging is a manual decision.
 */
import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../src/common/utils/phone.util';

const csv = process.argv.includes('--csv');
const prisma = new PrismaClient();

interface Row {
  id: string;
  churchId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  hasPin: boolean;
  hasUser: boolean;
  registrations: number;
  checkIns: number;
  messages: number;
  createdAt: Date;
}

interface Group {
  kind: 'EMAIL' | 'PHONE';
  churchId: string;
  value: string;
  rows: Row[];
}

function rank(a: Row, b: Row): number {
  if (a.hasPin !== b.hasPin) return a.hasPin ? -1 : 1;
  if (a.registrations !== b.registrations)
    return b.registrations - a.registrations;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

function group(
  kind: Group['kind'],
  rows: Row[],
  keyOf: (r: Row) => string | null,
): Group[] {
  const buckets = new Map<string, Row[]>();
  for (const row of rows) {
    const value = keyOf(row);
    if (!value) continue;
    const key = `${row.churchId}|${value}`;
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  const groups: Group[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    const [churchId, ...rest] = key.split('|');
    groups.push({
      kind,
      churchId,
      value: rest.join('|'),
      rows: [...members].sort(rank),
    });
  }
  return groups.sort((a, b) => b.rows.length - a.rows.length);
}

function describe(r: Row, keep: boolean): string {
  const flags = [
    r.status,
    r.hasPin ? 'has PIN' : null,
    r.hasUser ? 'staff user' : null,
    `${r.registrations} registrations`,
    `${r.checkIns} check-ins`,
    `${r.messages} messages`,
    `created ${r.createdAt.toISOString().slice(0, 10)}`,
  ].filter(Boolean);
  return `${keep ? 'KEEP?' : '     '} ${r.name} (${r.id}) [${flags.join(', ')}] email=${r.email ?? '-'} phone=${r.phone ?? '-'}`;
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const people = await prisma.person.findMany({
    select: {
      id: true,
      churchId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      membershipStatus: true,
      pinHash: true,
      userId: true,
      createdAt: true,
      _count: {
        select: {
          registrations: true,
          pastoralCheckIns: true,
          outreachMessages: true,
        },
      },
    },
  });

  const rows: Row[] = people.map((p) => ({
    id: p.id,
    churchId: p.churchId,
    name: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    phone: p.phone,
    status: p.membershipStatus,
    hasPin: !!p.pinHash,
    hasUser: !!p.userId,
    registrations: p._count.registrations,
    checkIns: p._count.pastoralCheckIns,
    messages: p._count.outreachMessages,
    createdAt: p.createdAt,
  }));

  const emailGroups = group('EMAIL', rows, (r) => {
    const e = r.email?.trim().toLowerCase();
    return e ? e : null;
  });
  const phoneGroups = group('PHONE', rows, (r) => {
    const raw = r.phone?.trim();
    return raw ? normalizePhone(raw) : null;
  });
  const blankEmails = rows.filter((r) => r.email !== null && !r.email.trim());
  const blankPhones = rows.filter((r) => r.phone !== null && !r.phone.trim());
  const badPhones = rows.filter(
    (r) => r.phone?.trim() && !normalizePhone(r.phone),
  );
  const groups = [...emailGroups, ...phoneGroups];

  if (csv) {
    console.log(
      [
        'type',
        'churchId',
        'value',
        'suggested',
        'personId',
        'name',
        'email',
        'phone',
        'status',
        'hasPin',
        'registrations',
        'checkIns',
        'messages',
        'createdAt',
      ].join(','),
    );
    for (const g of groups) {
      g.rows.forEach((r, i) =>
        console.log(
          [
            g.kind,
            g.churchId,
            g.value,
            i === 0 ? 'KEEP' : 'MERGE',
            r.id,
            r.name,
            r.email,
            r.phone,
            r.status,
            r.hasPin,
            r.registrations,
            r.checkIns,
            r.messages,
            r.createdAt.toISOString(),
          ]
            .map(csvCell)
            .join(','),
        ),
      );
    }
    return;
  }

  console.log(`People scanned:                  ${rows.length}`);
  console.log(`Duplicate email groups:          ${emailGroups.length}`);
  console.log(`Duplicate phone groups:          ${phoneGroups.length}`);
  console.log(`Blank-string emails (-> NULL):   ${blankEmails.length}`);
  console.log(`Blank-string phones (-> NULL):   ${blankPhones.length}`);
  console.log(`Phones that cannot be normalised: ${badPhones.length}`);

  for (const g of groups) {
    console.log(`\n${g.kind} ${g.value}  (church ${g.churchId})`);
    g.rows.forEach((r, i) => console.log(`  ${describe(r, i === 0)}`));
  }

  if (badPhones.length) {
    console.log('\nPHONES THAT CANNOT BE NORMALISED');
    for (const r of badPhones)
      console.log(`  ${r.name} (${r.id}): "${r.phone}"`);
  }

  console.log(
    groups.length === 0 && blankEmails.length === 0 && blankPhones.length === 0
      ? '\nNo conflicts. The unique indexes can be added as they are.'
      : '\nResolve the groups above (merge or clear one value) before adding the unique indexes.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
