import { CheckInReason } from '@prisma/client';
import { candidateTemplates, pickTemplate } from './template-selection';

const t = (id: string, checkInReason: CheckInReason | null = null) => ({
  id,
  checkInReason,
});

describe('template selection', () => {
  describe('candidateTemplates', () => {
    const all = [
      t('generic'),
      t('missed', CheckInReason.ABSENTEEISM),
      t('missed-2', CheckInReason.ABSENTEEISM),
      t('sick', CheckInReason.ILLNESS),
    ];

    it('prefers templates matching the check-in reason', () => {
      expect(
        candidateTemplates(all, CheckInReason.ABSENTEEISM).map((x) => x.id),
      ).toEqual(['missed', 'missed-2']);
    });

    it('falls back to generic templates when none match the reason', () => {
      expect(
        candidateTemplates(all, CheckInReason.BEREAVEMENT).map((x) => x.id),
      ).toEqual(['generic']);
    });

    it('uses generic templates when there is no check-in reason', () => {
      expect(candidateTemplates(all).map((x) => x.id)).toEqual(['generic']);
    });

    it('returns nothing when no template qualifies', () => {
      expect(
        candidateTemplates([t('sick', CheckInReason.ILLNESS)], null),
      ).toEqual([]);
    });
  });

  describe('pickTemplate', () => {
    it('returns null for an empty list', () => {
      expect(pickTemplate([])).toBeNull();
    });

    it('skips the template last used for the person', () => {
      const list = [t('a'), t('b')];
      for (const roll of [0, 0.5, 0.99]) {
        expect(pickTemplate(list, 'a', () => roll)?.id).toBe('b');
      }
    });

    it('reuses the last template when it is the only one', () => {
      expect(pickTemplate([t('a')], 'a')?.id).toBe('a');
    });

    it('picks randomly among the rest', () => {
      const list = [t('a'), t('b'), t('c')];
      expect(pickTemplate(list, null, () => 0)?.id).toBe('a');
      expect(pickTemplate(list, null, () => 0.99)?.id).toBe('c');
    });
  });
});
