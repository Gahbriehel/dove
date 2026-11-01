export const TEMPLATE_PLACEHOLDERS = [
  'firstName',
  'adminName',
  'churchName',
] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];
export type TemplateVars = Record<TemplatePlaceholder, string>;

export const TEMPLATE_BODY_MAX_LENGTH = 1000;

const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]*?)\s*\}\}/g;

const CANONICAL_NAMES = new Map<string, TemplatePlaceholder>(
  TEMPLATE_PLACEHOLDERS.map((name) => [name.toLowerCase(), name]),
);

export class TemplateRenderer {
  /**
   * Replaces `{{firstName}}`, `{{adminName}}` and `{{churchName}}`. Matching
   * ignores case and inner whitespace. Unknown tokens are left untouched.
   */
  static render(body: string, vars: TemplateVars): string {
    return body.replace(PLACEHOLDER_PATTERN, (match, token: string) => {
      const name = CANONICAL_NAMES.get(token.toLowerCase());
      return name ? vars[name] : match;
    });
  }

  /** Returns every distinct token in `body` that is not an allowed placeholder. */
  static findUnknownPlaceholders(body: string): string[] {
    const unknown = new Set<string>();
    for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
      if (!CANONICAL_NAMES.has(match[1].toLowerCase())) {
        unknown.add(match[0]);
      }
    }
    return [...unknown];
  }
}

export function resolveAdminName(user: {
  displayName: string | null;
  firstName: string;
}): string {
  return user.displayName?.trim() || user.firstName;
}

export function resolveChurchLabel(church: {
  shortName: string | null;
  name: string;
}): string {
  return church.shortName?.trim() || church.name;
}
