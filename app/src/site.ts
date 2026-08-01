/**
 * The site's own absolute origin, in one place.
 *
 * It exists because an og tag cannot be relative: a crawler resolves `og:url` and `og:image`
 * against nothing, so both have to carry the origin. Everything else in the app addresses
 * itself with a path and never needs this.
 *
 * Set at Gate 8 to the claimed production domain (OQ-1 chain: matterhorn-app.vercel.app was
 * free and is ours). Everything that needs an absolute origin (og tags, sitemap, the replay
 * QR payload) derives from this one line.
 */
export const SITE_URL = 'https://matterhorn-app.vercel.app';
