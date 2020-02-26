'use strict';

const client = require('./client'),
  { migrate } = require('postgres-migrations'),
  path = require('path'),
  {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
    DATA_STRUCTURES
  } = require('../services/constants'),
  log = require('../services/log').setup({ file: __filename }),
  { logGenericError } = require('../services/errors'),
  bluebird = require('bluebird'),
  { getComponents, getLayouts } = require('amphora-fs');

/**
 * @return {Promise[]}
 */
function createRemainingTables() {
  var promises = [];

  for (let i = 0; i < DATA_STRUCTURES.length; i++) {
    let STRUCTURE = DATA_STRUCTURES[i];

    if (STRUCTURE !== 'components' && STRUCTURE !== 'pages' && STRUCTURE !== 'layouts' && STRUCTURE !== 'uris') {
      promises.push(client.createTable(STRUCTURE));
    }
  }

  return bluebird.all(promises);
}

/**
 * Create all tables needed
 *
 * @return {Promise}
 */
function createTables() {
  return bluebird.all(getComponents().map(component => client.createTable(`components.${component}`)))
    .then(() => bluebird.all(getLayouts().map(layout => client.createTableWithMeta(`layouts.${layout}`))))
    .then(() => client.createTableWithMeta('pages'))
    .then(() => createRemainingTables());
}

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
      log('info', 'Starting migration');
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
    .then(() => createTables())
    .then(() => ({ server: `${postgresHost}:${POSTGRES_PORT}` }))
}

module.exports.setup = setup;
