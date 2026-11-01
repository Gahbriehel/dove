import { CheckInReason } from '@prisma/client';

export interface SelectableTemplate {
  id: string;
  checkInReason: CheckInReason | null;
}

/**
 * Narrows active templates for a purpose down to the ones worth offering.
 * For a pastoral check-in, templates written for the check-in's reason win;
 * generic ones (no reason) are used only when none match.
 */
export function candidateTemplates<T extends SelectableTemplate>(
  templates: T[],
  checkInReason?: CheckInReason | null,
): T[] {
  if (!checkInReason) {
    return templates.filter((t) => t.checkInReason === null);
  }
  const specific = templates.filter((t) => t.checkInReason === checkInReason);
  return specific.length > 0
    ? specific
    : templates.filter((t) => t.checkInReason === null);
}

/**
 * Picks one template, skipping the one last used for this person when another
 * exists so consecutive messages do not look identical.
 */
export function pickTemplate<T extends SelectableTemplate>(
  candidates: T[],
  lastUsedTemplateId?: string | null,
  random: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null;
  const fresh = candidates.filter((t) => t.id !== lastUsedTemplateId);
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[Math.floor(random() * pool.length)];
}
