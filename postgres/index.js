'use strict';

const client = require('./client'),
  { createDb, migrate } = require('postgres-migrations'),
  {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
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
  createDb('clay', {
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
        '/Users/jowen/Coding/amphora-storage-postgres/services/migrations' // TODO relative filepath
      );
    })
    .then(() => {
      console.log('Migrations Complete');
    })
    .catch(err => {
      console.error(err);
    });

  // connect to db
  return client.connect()
    .then(() => ({ server: `${postgresHost}:${POSTGRES_PORT}` }));
}

module.exports.setup = setup;
