import sanitizeHtml from 'sanitize-html';

/**
 * Matches rich-text editor output (e.g. Quill), which always wraps content
 * in block tags like <p>, even for plain single-line messages.
 */
export function isHtmlContent(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'span',
  'div',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  '*': ['style'],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
  '*': {
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
    'background-color': [
      /^#[0-9a-fA-F]{3,8}$/,
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
    ],
    'text-align': [/^left$|^right$|^center$|^justify$/],
    'font-weight': [/^bold$|^normal$|^\d+$/],
    'font-style': [/^italic$|^normal$/],
    'text-decoration': [/^underline$|^line-through$|^none$/],
  },
};

/**
 * Sanitizes rich-text email message HTML down to a safe subset of tags,
 * attributes and inline styles, stripping scripts, event handlers and
 * unsafe link schemes.
 */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    },
  });
}
