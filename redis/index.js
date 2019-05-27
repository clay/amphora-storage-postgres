'use strict';

const bluebird = require('bluebird'),
  Redis = require('ioredis'),
  { REDIS_URL, REDIS_HASH } = require('../services/constants'),
  { isPublished, isUri, isUser } = require('clayutils'),
  { notFoundError, logGenericError } = require('../services/errors'),
  Redlock = require('redlock');

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

    // TODO: Move this config to another module maybe?
    const redlock = new Redlock([module.exports.client], {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms

      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount: 0,

      // the time in ms between attempts
      retryDelay: 200, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200 // time in ms
    });

    redlock.on('clientError', logGenericError(__filename));
    module.exports.redlock = redlock;

    resolve({ server: redisUrl });
  });
}

function lockRedisForAction(resourceId, ttl) {
  return module.exports.redlock.lock(resourceId, ttl);
}

function unlockWhenReady(lock, cb) {
  return cb()
    .then(result => module.exports.redlock.unlock(lock).then(() => result));
}

function getFromState(id) {
  return module.exports.client.getAsync(id);
}

function setState(action, state, expire) {
  return module.exports.client.setAsync(action, state)
    .then(() => {
      if (expire) return module.exports.client.expire(action, expire); // Expire in 10 minutes
    });
}

function sleepAndRun(cb, ms = 1000) {
  return new Promise(resolve => setTimeout(() => cb().then(resolve), ms));
}

function applyLock(action, cb) {
  const resourceId = action + '-lock',
    RETRY_TIME = 1500, // ms
    KEY_TTL = 10 * 60, // secs
    LOCK_TTL = 1200;

  return getFromState(action).then(state => {
    /**
     * If its ONGOING, just re-run this func after a while
     * to see if the state changed
     */
    if (state === 'ONGOING') {
      return sleepAndRun(() => applyLock(action, cb), RETRY_TIME);
    }

    if (state === 'FINISHED') return Promise.resolve();

    if (!state || state === 'RETRY') return setState(action, 'ONGOING')
      .then(() => lockRedisForAction(resourceId, LOCK_TTL))
      .then(lock => unlockWhenReady(lock, cb))
      .then(() => setState(action, 'FINISHED', KEY_TTL))
      .catch(() => setState(action, 'RETRY'));

    return Promise.resolve();
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
module.exports.redlock;
module.exports.applyLock = applyLock;
module.exports.createClient = createClient;
module.exports.get = get;
module.exports.put = put;
module.exports.batch = batch;
module.exports.del = del;

// For testing
module.exports.stubClient = mock => module.exports.client = mock;
