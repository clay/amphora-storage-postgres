'use strict';

const Promise = require('bluebird'),
  { logGenericError } = require('../services/errors'),
  emptyModule = {
    lock: () => Promise.resolve(),
    unlock: () => Promise.resolve()
  },
  CONFIG = {
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
  },
  STATE = {
    ONGOING: 'ON-GOING',
    RETRY: 'RETRY',
    FINISHED: 'FINISHED'
  },
  RETRY_TIME = 1500, // ms
  KEY_TTL = 10 * 60, // secs
  LOCK_TTL = 5000; // ms

let log = require('../services/log').setup({ file: __filename }),
  Redlock = require('redlock'),
  _logGenericError = logGenericError(__filename),
  actionRetryCount = 0,
  actionRetryTotal = 5;

/**
 * Adds a lock to redis with the given lockName
 * for a determined period of time
 *
 * @param {string} lockName
 * @param {number} ttl
 * @returns {Promise}
 */
function addLock(lockName, ttl) {
  log('trace', `Trying to lock redis for resource id ${lockName}`, {
    lockName,
    processId: process.pid
  });
  return module.exports.redlock.lock(lockName, ttl);
}

/**
 * Removes the specified lock
 * when the callback returns
 *
 * @param {Object} lock
 * @param {string} lockName
 * @param {Function} promise
 * @returns {Promise}
 */
function removeLockWhenReady(lock, lockName, promise) {
  return promise().then(result => {
    return module.exports.redlock.unlock(lock).then(() => {
      log('trace', `Releasing lock for resource id ${lockName}`, {
        lockName,
        processId: process.pid
      });

      return result;
    });
  });
}

/**
 * Gets the value of the specified key in redis
 *
 * @param {string} key
 * @returns {Promise}
 */
function getState(key) {
  return module.exports.redis.getAsync(key);
}

/**
 * Sets a key-value pair into redis.
 * This key will have an expire time if specified
 * @param {string} key
 * @param {string} value
 * @param {number} expireTime
 * @returns {Promise}
 */
function setState(key, value, expireTime) {
  return module.exports.redis.setAsync(key, value).then(() => {
    if (expireTime) return module.exports.redis.expire(key, expireTime);
  });
}

/**
 * Waits an amount of time, then runs the callback
 *
 * @param {number} ms
 * @returns {Promise}
 */
function delay(ms = RETRY_TIME) {
  return Promise.delay(ms);
}

/**
 *
 * @param {string} action
 * @param {Function} cb
 * @returns {Promise}
 */
function applyLock(action, cb) {
  const lockName = `${action}-lock`;

  return getState(action).then(state => {
    if (state === STATE.FINISHED) return;

    /**
     * If it's ONGOING, just re-run this function after a while
     * to see if the state changed.
     */
    if (state === STATE.ONGOING) {
      return delay()
        .then(() => applyLock(action, cb));
    }

    if (!state || state === STATE.RETRY)
      return lockAndExecute(action, lockName, cb)
        .catch(() => retryLocking(action, cb));
  });
}

function lockAndExecute(action, lockName, cb) {
  return setState(action, STATE.ONGOING)
    .then(() => addLock(lockName, LOCK_TTL))
    .then(lock => removeLockWhenReady(lock, lockName, cb))
    .then(() => setState(action, STATE.FINISHED, KEY_TTL));
}

function retryLocking(action, cb) {
  actionRetryCount++;

  if (actionRetryCount >= actionRetryTotal) {
    log('error', `Action "${action}" could not be executed`);
    return setState(action, STATE.FINISHED, KEY_TTL);
  }

  return setState(action, STATE.RETRY)
    .then(delay)
    .then(() => applyLock(action, cb));
}

/**
 * Saves both the redis and redlock instance
 * into the module
 *
 * @param {Object} instance Redis instance
 * @returns {Object} Redlock instance
 */
function setupRedlock(instance) {
  if (!instance) return emptyModule;

  const redlock = new Redlock([instance], CONFIG);

  redlock.on('clientError', _logGenericError);

  module.exports.redis = instance;
  module.exports.redlock = redlock;

  return redlock;
}

module.exports.redis;
module.exports.redlock;
module.exports.setupRedlock = setupRedlock;
module.exports.applyLock = applyLock;

module.exports.stubRedlockModule = mock => Redlock = mock;
module.exports.stubLogGenericError = mock => _logGenericError = mock;
module.exports.stubLog = mock => log = mock;
module.exports.stubActionRetryTotal = mock => actionRetryTotal = mock;

module.exports.addLock = addLock;
module.exports.removeLockWhenReady = removeLockWhenReady;
module.exports.getState = getState;
module.exports.setState = setState;
module.exports.delay = delay;
module.exports.lockAndExecute = lockAndExecute;
module.exports.retryLocking = retryLocking;
