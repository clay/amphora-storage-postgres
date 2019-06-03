'use strict';

const Redlock = require('redlock'),
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
  action_retry_total = 5;

let log = require('../services/log').setup({ file: __filename }),
  action_retry_count = 0;

/**
 *
 * @param {string} resourceId
 * @param {number} ttl
 * @returns {Promise}
 */
function lockRedisForAction(resourceId, ttl) {
  log('trace', `Trying to lock redis for resource id ${resourceId}`, {
    resourceId,
    processId: process.pid
  });
  return module.exports.redlock.lock(resourceId, ttl);
}

/**
 *
 * @param {Object} lock
 * @param {string} resourceId
 * @param {Function} cb
 * @returns {Promise}
 */
function unlockWhenReady(lock, resourceId, cb) {
  return cb().then(result =>
    module.exports.redlock.unlock(lock).then(() => {
      log('trace', `Releasing lock for resource id ${resourceId}`, {
        resourceId,
        processId: process.pid
      });
      return result;
    })
  );
}

/**
 *
 * @param {string} id
 * @returns {Promise}
 */
function getFromState(id) {
  return module.exports.redis.getAsync(id);
}

/**
 *
 * @param {string} action
 * @param {string} state
 * @param {number} expire
 * @returns {Promise}
 */
function setState(action, state, expire) {
  return module.exports.redis.setAsync(action, state).then(() => {
    if (expire) return module.exports.redis.expire(action, expire);
  });
}

/**
 *
 * @param {Function} cb
 * @param {number} ms
 * @returns {Promise}
 */
function sleepAndRun(cb, ms = 1000) {
  return new Promise(resolve => setTimeout(() => cb().then(resolve), ms));
}

/**
 *
 * @param {string} action
 * @param {Function} cb
 * @returns {Promise}
 */
function applyLock(action, cb) {
  const resourceId = `${action}-lock`,
    STATE = {
      ONGOING: 'ON-GOING',
      RETRY: 'RETRY',
      FINISHED: 'FINISHED'
    },
    RETRY_TIME = 1500, // ms
    KEY_TTL = 10 * 60, // secs
    LOCK_TTL = 5000; // ms

  return getFromState(action).then(state => {
    /**
     * If it's ONGOING, just re-run this function after a while
     * to see if the state changed.
     */
    if (state === STATE.ONGOING) {
      return sleepAndRun(() => applyLock(action, cb), RETRY_TIME);
    }

    if (!state || state === STATE.RETRY)
      return setState(action, STATE.ONGOING)
        .then(() => lockRedisForAction(resourceId, LOCK_TTL))
        .then(lock => unlockWhenReady(lock, resourceId, cb))
        .then(() => setState(action, STATE.FINISHED, KEY_TTL))
        .catch(() => {
          action_retry_count++;

          if (action_retry_count === action_retry_total) {
            log('error', `Action "${action}" could not be executed`);
            return setState(action, STATE.FINISHED, KEY_TTL);
          }

          return setState(action, STATE.RETRY).then(() =>
            sleepAndRun(() => applyLock(action, cb), RETRY_TIME)
          );
        });
  });
}

/**
 *
 * @param {Object} instance
 * @returns {Object}
 */
function setup(instance) {
  if (!instance) return emptyModule;

  const redlock = new Redlock([instance], CONFIG);

  redlock.on('clientError', logGenericError(__filename));

  module.exports.redis = instance;
  module.exports.redlock = redlock;

  return redlock;
}

module.exports.redis = {};
module.exports.redlock;

module.exports.setup = setup;
module.exports.applyLock = applyLock;
