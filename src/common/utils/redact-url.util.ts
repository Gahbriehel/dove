const PROFILE_TOKEN_PATH = /(\/profile\/)(?!claim(?:[/?#]|$))[^/?#]+/;

/** Replaces secret profile tokens in a URL so it is safe to log. */
export function redactUrl(url: string | undefined): string {
  if (!url) return '';
  return url.replace(PROFILE_TOKEN_PATH, '$1:token');
}
