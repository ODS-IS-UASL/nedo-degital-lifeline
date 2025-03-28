export const version = '1.0.2';

export const cacheControlHeader = process.env.IS_OFFLINE ?
  'no-cache' :
  `public, max-age=31536000, immutable`;
