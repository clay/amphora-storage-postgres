'use strict';

const client = require('./client'),
  { createDb, migrate } = require('postgres-migrations'),
  path = require('path'),
  {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
  } = require('../services/constants');

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

  // run migrations
  createDb(POSTGRES_DB, {
    defaultDatabase: POSTGRES_DB,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: POSTGRES_PORT
  })
    .then(() => {
      return migrate(
        {
          database: POSTGRES_DB,
          user: POSTGRES_USER,
          password: POSTGRES_PASSWORD,
          host: POSTGRES_HOST,
          port: POSTGRES_PORT
        },
        path.join(__dirname, '../services/migrations')
      );
    })
    .then(() => {
      console.log('Migrations Complete'); // todo use log function
    })
    .catch(err => {
      console.error(err); // todo use log function
    });

  // connect to db
  return client.connect().then(() => ({ server: `${postgresHost}:${POSTGRES_PORT}` }));
}

module.exports.setup = setup;
