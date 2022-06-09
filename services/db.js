'use strict';

var redis = require('../redis'),
  log = require('./log').setup({ file: __filename }),
  postgres = require('../postgres/client'),
  { isUri } = require('clayutils'),
  { CACHE_ENABLED } = require('./constants');

/**
 * Write a single value to cache and db
 *
 * @param  {String} key
 * @param  {Object} value
 * @param  {Boolean} testCacheEnabled used for tests
 * @return {Promise}
 */
function put(key, value, testCacheEnabled) {
  const cacheEnabled = testCacheEnabled || CACHE_ENABLED;

  return postgres.put(key, value)
    .then((res) => {
      // persist to cache only if cache is set up/enabled, return postgres result regardless
      if (cacheEnabled) {
        return redis.put(key, value).then(() => res);
      }

      return res;
    }).catch(err => {
      log('warn', JSON.stringify({key, value, err}));
    });
}

/**
 * Return a value from the db or cache. Must
 * return a Object, not stringified JSON
 *
 * @param  {String} key
 * @param  {Boolean} testCacheEnabled used for tests
 * @return {Promise}
 */
function get(key, testCacheEnabled) {
  const cacheEnabled = testCacheEnabled || CACHE_ENABLED;

  if (cacheEnabled) {
    return redis.get(key)
      .then(data => {
        // Parse non-uri data to match Postgres
        return isUri(key) ? data : JSON.parse(data);
      })
      .catch(() => {
        return postgres.get(key)
          .then(data => {
            return redis.put(key, isUri(key) ? data : JSON.stringify(data))
              .then(() => data)
              .catch(() => {
                log('warn', `Failed to set Redis key ${key} after fetch from Postgres`);
                return data;
              });
          });
      });
  }

  return postgres.get(key);
}

/**
 * Process a whole group of saves
 *
 * @param  {Array} ops
 * @param  {Boolean} testCacheEnabled used for tests
 * @return {Promise}
 */
function batch(ops, testCacheEnabled) {
  const cacheEnabled = testCacheEnabled || CACHE_ENABLED;

  return postgres.batch(ops)
    .then((res) => {
      if (cacheEnabled) {
        return redis.batch(ops).then(() => res);
      }

      return res;
    }).catch(err => {
      log('warn', JSON.stringify({ops, err}));
    });
}

/**
 * Remove a value from cache and db
 *
 * @param  {String} key
 * @return {Promise}
 */
function del(key) {
  return redis.del(key)
    .then(() => postgres.del(key));
}

module.exports.put = put;
module.exports.get = get;
module.exports.del = del;
module.exports.batch = batch;
module.exports.raw = postgres.raw;
module.exports.putMeta = postgres.putMeta;
module.exports.getMeta = postgres.getMeta;
module.exports.patchMeta = postgres.patchMeta;
module.exports.createReadStream = postgres.createReadStream;
