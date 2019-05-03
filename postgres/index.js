'use strict';

const client = require('./client'),
  { migrate } = require('postgres-migrations'),
  path = require('path'),
  {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
  } = require('../services/constants'),
  log = require('../services/log').setup({ file: __filename }),
  { logGenericError } = require('../services/errors');

/**
 * Connect and create schemas/tables
 *
 * @param {String} testPostgresHost used for testing
 * @return {Promise}
 */
function setup(testPostgresHost) {
  const postgresHost = testPostgresHost || POSTGRES_HOST;

  if (!postgresHost) {
    return Promise.reject(new Error('No postgres host set'));
  }

  return client.connect()
    .then(() => {
      return migrate(
        {
          database: POSTGRES_DB,
          user: POSTGRES_USER,
          password: POSTGRES_PASSWORD,
          host: postgresHost,
          port: POSTGRES_PORT
        },
        path.join(__dirname, '../services/migrations')
      );
    })
    .then(() => {
      log('info', 'Migrations Complete');
    })
    .then(() => ({ server: `${postgresHost}:${POSTGRES_PORT}` }))
    .catch(logGenericError);
}

module.exports.setup = setup;
