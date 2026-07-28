/**
 * The site's own absolute origin, in one place.
 *
 * It exists because an og tag cannot be relative: a crawler resolves `og:url` and `og:image`
 * against nothing, so both have to carry the origin. Everything else in the app addresses
 * itself with a path and never needs this.
 *
 * `http://localhost` is a placeholder that is honest about being one: it is not a domain
 * anybody will ship, so a shell that escapes with it is obvious rather than plausible. Gate 8
 * replaces this line with the deployed origin, and nothing else in the repo changes.
 */
export const SITE_URL = 'http://localhost';
