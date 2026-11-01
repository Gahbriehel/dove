/**
 * One-off migration that rewrites stored phone numbers to E.164.
 *
 *   bun scripts/normalize-phones.ts           # dry run (default)
 *   bun scripts/normalize-phones.ts --apply   # write the converted values
 *
 * Invalid numbers are left untouched and listed. People who end up with the
 * same normalised number within a church are reported, never merged.
 */
import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../src/common/utils/phone.util';

const BATCH_SIZE = 100;
const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

interface Row {
  id: string;
  phone: string | null;
  label: string;
  group: string;
}

interface Summary {
  converted: Array<{ id: string; from: string; to: string }>;
  alreadyValid: number;
  invalid: Array<{ id: string; label: string; phone: string }>;
  duplicates: Array<{ group: string; phone: string; labels: string[] }>;
}

function analyse(rows: Row[]): Summary {
  const summary: Summary = {
    converted: [],
    alreadyValid: 0,
    invalid: [],
    duplicates: [],
  };
  const seen = new Map<string, Row[]>();

  for (const row of rows) {
    const phone = row.phone?.trim();
    if (!phone) continue;

    const normalized = normalizePhone(phone);
    if (!normalized) {
      summary.invalid.push({ id: row.id, label: row.label, phone });
      continue;
    }

    if (normalized === row.phone) summary.alreadyValid++;
    else
      summary.converted.push({ id: row.id, from: row.phone!, to: normalized });

    const key = `${row.group}|${normalized}`;
    seen.set(key, [...(seen.get(key) ?? []), row]);
  }

  for (const [key, group] of seen) {
    if (group.length > 1) {
      summary.duplicates.push({
        group: group[0].group,
        phone: key.split('|')[1],
        labels: group.map((r) => `${r.label} (${r.id})`),
      });
    }
  }
  return summary;
}

function report(name: string, summary: Summary) {
  console.log(`\n== ${name} ==`);
  console.log(`  to convert:    ${summary.converted.length}`);
  console.log(`  already valid: ${summary.alreadyValid}`);
  console.log(`  invalid:       ${summary.invalid.length}`);
  console.log(`  duplicates:    ${summary.duplicates.length}`);

  for (const bad of summary.invalid) {
    console.log(`  INVALID   ${bad.label} (${bad.id}): "${bad.phone}"`);
  }
  for (const dup of summary.duplicates) {
    console.log(`  DUPLICATE ${dup.phone}: ${dup.labels.join(' | ')}`);
  }
}

async function writeInBatches(
  changes: Summary['converted'],
  update: (id: string, phone: string) => Promise<unknown>,
) {
  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(batch.map((c) => update(c.id, c.to)) as never);
  }
}

async function main() {
  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  const [people, users, churches] = await Promise.all([
    prisma.person.findMany({
      where: { phone: { not: null } },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        churchId: true,
      },
    }),
    prisma.user.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true, email: true },
    }),
    prisma.church.findMany({
      where: { phone: { not: null } },
      select: { id: true, phone: true, name: true },
    }),
  ]);

  const peopleSummary = analyse(
    people.map((p) => ({
      id: p.id,
      phone: p.phone,
      label: `${p.firstName} ${p.lastName}`,
      group: p.churchId,
    })),
  );
  const userSummary = analyse(
    users.map((u) => ({
      id: u.id,
      phone: u.phone,
      label: u.email,
      group: 'users',
    })),
  );
  const churchSummary = analyse(
    churches.map((c) => ({
      id: c.id,
      phone: c.phone,
      label: c.name,
      group: 'churches',
    })),
  );

  report('people', peopleSummary);
  report('users', userSummary);
  report('churches', churchSummary);

  if (!apply) {
    console.log('\nNothing written. Re-run with --apply to convert.');
    return;
  }

  await writeInBatches(peopleSummary.converted, (id, phone) =>
    prisma.person.update({ where: { id }, data: { phone } }),
  );
  await writeInBatches(userSummary.converted, (id, phone) =>
    prisma.user.update({ where: { id }, data: { phone } }),
  );
  await writeInBatches(churchSummary.converted, (id, phone) =>
    prisma.church.update({ where: { id }, data: { phone } }),
  );

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
