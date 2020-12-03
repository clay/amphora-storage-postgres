'use strict';

// Postgres
module.exports.POSTGRES_USER     = process.env.CLAY_STORAGE_POSTGRES_USER     || 'postgres';
module.exports.POSTGRES_PASSWORD = process.env.CLAY_STORAGE_POSTGRES_PASSWORD || 'example';
module.exports.POSTGRES_HOST     = process.env.CLAY_STORAGE_POSTGRES_HOST;
module.exports.POSTGRES_PORT     = process.env.CLAY_STORAGE_POSTGRES_PORT
  ? Number(process.env.CLAY_STORAGE_POSTGRES_PORT)
  : 5432;
module.exports.POSTGRES_DB       = process.env.CLAY_STORAGE_POSTGRES_DB       || 'clay';
module.exports.CONNECTION_POOL_MIN = parseInt(process.env.CLAY_STORAGE_CONNECTION_POOL_MIN, 10) || 2;
module.exports.CONNECTION_POOL_MAX = parseInt(process.env.CLAY_STORAGE_CONNECTION_POOL_MAX, 10) || 10;

module.exports.PAGE_SIZE = parseInt(process.env.CLAY_STORAGE_PAGE_SIZE) || null;

// Redis
module.exports.CACHE_ENABLED     = process.env.CLAY_STORAGE_POSTGRES_CACHE_ENABLED     || false;
module.exports.REDIS_URL         = process.env.CLAY_STORAGE_POSTGRES_CACHE_HOST;
module.exports.REDIS_TTL = process.env.CLAY_STORAGE_POSTGRES_CACHE_TTL
  ? Number(process.env.CLAY_STORAGE_POSTGRES_CACHE_TTL)
  : 60 * 60 * 24;  // One day.

// Application code
module.exports.DATA_STRUCTURES   = ['components', 'layouts', 'pages', 'uris', 'lists', 'users'];
