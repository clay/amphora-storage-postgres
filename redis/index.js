'use strict';

const bluebird = require('bluebird'),
  Redis = require('ioredis'),
  { REDIS_URL, REDIS_HASH } = require('../services/constants'),
  { isPublished, isUri, isUser } = require('clayutils'),
  { notFoundError, logGenericError } = require('../services/errors'),
  lock = require('./lock');

var log = require('../services/log').setup({ file: __filename });

/**
 * Connect to Redis and store the client
 *
 * @param {String} testRedisUrl, used for testing only
 * @return {Promise}
 */
function createClient(testRedisUrl) {
  const redisUrl = testRedisUrl || REDIS_URL;

  if (!redisUrl) {
    return bluebird.reject(new Error('No Redis URL set'));
  }

  log('debug', `Connecting to Redis at ${redisUrl}`);

  return new bluebird(resolve => {
    module.exports.client = bluebird.promisifyAll(new Redis(redisUrl));
    module.exports.client.on('error', logGenericError(__filename));

    lock.setup(module.exports.client);

    resolve({ server: redisUrl });
  });
}

/**
 * Determines if we should write to cache
 *
 * @param  {String} key
 * @return {boolean}
 */
function shouldProcess(key) {
  return isPublished(key) || isUri(key) || isUser(key);
}

/**
 * Write a single value to a hash
 *
 * @param  {String} key
 * @param  {String} value
 * @return {Promise}
 */
function put(key, value) {
  if (!shouldProcess(key)) return bluebird.resolve();

  return module.exports.client.hsetAsync(REDIS_HASH, key, value);
}

/**
 * Read a single value from a hash
 *
 * @param  {String} key
 * @return {Promise}
 */
function get(key) {
  if (!module.exports.client) {
    return bluebird.reject(notFoundError(key));
  }

  return module.exports.client.hgetAsync(REDIS_HASH, key)
    .then(data => data || bluebird.reject(notFoundError(key)));
}

/**
 * [batch description]
 * @param  {[type]} ops
 * @return {[type]}
 */
function batch(ops) {
  var batch = [];

  if (!ops.length) {
    return bluebird.resolve();
  }

  for (let i = 0; i < ops.length; i++) {
    let { key, value } = ops[i];

    if (shouldProcess(key)) {
      batch.push(key);
      batch.push(value);
    }
  }

  if (!batch.length) {
    return bluebird.resolve();
  }

  return module.exports.client.hmsetAsync(REDIS_HASH, batch);
}

/**
 * [del description]
 * @param  {[type]} key
 * @return {[type]}
 */
function del(key) {
  if (!shouldProcess(key) || !module.exports.client) return bluebird.resolve();

  return module.exports.client.hdelAsync(REDIS_HASH, key);
}

module.exports.client = null;
module.exports.applyLock = lock.applyLock;
module.exports.createClient = createClient;
module.exports.get = get;
module.exports.put = put;
module.exports.batch = batch;
module.exports.del = del;

// For testing
module.exports.stubClient = mock => module.exports.client = mock;
