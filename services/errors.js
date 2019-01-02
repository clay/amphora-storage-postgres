'use strict';

var log = require('./log').setup({ file: __filename });

/**
 * Format an error for when a value is not
 * found in the DB('s)
 *
 * @param  {String} key
 * @return {Error}
 */
function notFoundError(key) {
  var error = new Error(`Key not found in database: ${key}`);

  error.name = 'NotFoundError';
  error.key = key;
  return error;
}

/**
 * Format an error for when the key
 * is not provided
 *
 * @return {Error}
 */
function noKeyError() {
  const error = new Error('No key provided');

  error.name = 'NoKeyError';
  return error;
}

/**
 * Log an error
 *
 * @param  {String} file
 * @return {function}
 */
function logGenericError(file) {
  return (err) => log('error', err.message, { file });
}

module.exports.notFoundError = notFoundError;
module.exports.noKeyError = noKeyError;
module.exports.logGenericError = logGenericError;

// For testing
module.exports.setLog = mock => log = mock;
