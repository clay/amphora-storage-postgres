'use strict';

const postgres = require('../postgres'),
  redis = require('../redis'),
  { CACHE_ENABLED } = require('./constants');
var log = require('./log').setup({ file: __filename });

/**
 * Log the successful connection to either db
 * @param  {String} name
 * @param  {Object} resp
 */
function logConnectionSuccess(name, resp) {
  log('info', `Connected to ${name} successfully at ${resp.server}`, resp);
  log('info', `Resp Object: ${resp}`, resp);
}

/**
 * Log any error that comes in
 * @param  {Error} err
 */
function logConnectionError(err) {
  log('error', err.message, { stack: err.stack });
}

/**
 * Connect and create schemas/tables
 *
 * @param  {Boolean} testCacheEnabled used for tests
 * @return {Promise}
 */
function setup(testCacheEnabled) {
  const promises = [],
    cacheEnabled = testCacheEnabled || CACHE_ENABLED;

  promises.push(postgres.setup().then(resp => logConnectionSuccess('Postgres', resp)));

  // only create redis client if caching is enabled
  if (cacheEnabled) {
    promises.push(redis.createClient().then(resp => logConnectionSuccess('Redis', resp)));
  }

  return Promise.all(promises).catch(logConnectionError);
}

module.exports = setup;

// For testing
module.exports.setLog = mock => log = mock;
