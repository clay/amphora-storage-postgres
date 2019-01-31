'use strict';

const bluebird = require('bluebird'),
  Redis = require('ioredis'),
  { REDIS_URL, REDIS_HASH, REDIS_CLUSTER_HOSTS } = require('../services/constants'),
  { isPublished, isUri, isUser } = require('clayutils'),
  { notFoundError, logGenericError } = require('../services/errors');
var log = require('../services/log').setup({ file: __filename });

// Promisify all ioredis methods
Redis.Promise = bluebird;

/**
 * Creates a client connecting to a
 * Redis cluster.
 *
 * @param {String} redisUrl
 * @returns {Promise}
 */
function createClusterClient(redisUrl) {
  // Generate the endpoints array from the cluster env var
  const endpoints = redisUrl.replace(/redis\:\/\//gi, '').split(',') // Split on commas
    .map(node => node.trim()) // Make sure we account for spaces in each declaration
    .map(node => {
      let [host, port = 6379] = node.split(':'); // Split between host and port, default port to 6379 if just host

      if (typeof port === 'string') port = parseInt(port, 10); // Parse the sring for ports
      return { host, port }; // Return the formatted object
    });

  return new bluebird(resolve => {
    module.exports.client = new Redis.Cluster(endpoints);
    module.exports.client.on('error', logGenericError(__filename));

    resolve({ server: redisUrl });
  });
}

/**
 * Creates a client connecting to a single
 * Redis instance.
 *
 * @param {String} redisUrl
 * @returns {Promise}
 */
function createBasicClient(redisUrl) {
  log('debug', `Connecting to Redis at ${redisUrl}`);

  return new bluebird(resolve => {
    module.exports.client = new Redis(redisUrl);
    module.exports.client.on('error', logGenericError(__filename));

    resolve({ server: redisUrl });
  });
}

/**
 * Either connect to the Redis instance or
 * a Redis Cluster
 *
 * @param {String} testRedisUrl used for testing only
 * @param {String} testClusterString used for testing only
 * @return {Promise}
 */
function createClient(testRedisUrl, testClusterString) {
  if (REDIS_URL || testRedisUrl) return createBasicClient(REDIS_URL || testRedisUrl);
  else if (REDIS_CLUSTER_HOSTS || testClusterString) return createClusterClient(REDIS_CLUSTER_HOSTS || testClusterString);
  else return bluebird.reject(new Error('No redis host or cluster host(s) defined'));
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

  return module.exports.client.hset(REDIS_HASH, key, value);
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

  return module.exports.client.hget(REDIS_HASH, key)
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

  return module.exports.client.hmset(REDIS_HASH, batch);
}

/**
 * [del description]
 * @param  {[type]} key
 * @return {[type]}
 */
function del(key) {
  if (!shouldProcess(key) || !module.exports.client) return bluebird.resolve();

  return module.exports.client.hdel(REDIS_HASH, key);
}

module.exports.client = null;
module.exports.createClient = createClient;
module.exports.get = get;
module.exports.put = put;
module.exports.batch = batch;
module.exports.del = del;

// For testing
module.exports.stubClient = mock => module.exports.client = mock;
