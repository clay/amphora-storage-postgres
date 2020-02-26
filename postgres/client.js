'use strict';

const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, CONNECTION_POOL_MIN, CONNECTION_POOL_MAX } = require('../services/constants'),
  { notFoundError } = require('../services/errors'),
  { parseOrNot, wrapInObject, decode } = require('../services/utils'),
  { findSchemaAndTable, wrapJSONStringInObject } = require('../services/utils'),
  knexLib = require('knex'),
  { isList, isUri } = require('clayutils'),
  TransformStream = require('../services/list-transform-stream'),
  META_PUT_PATCH_FN = patch('meta');
var knex, log = require('../services/log').setup({ file: __filename });

/**
 * Connect to the default DB and create the Clay
 * DB. Once the DB has been made the connection
 * can be killed and we can try to re-connect
 * to the Clay DB
 *
 * @returns {Promise}
 */
function createDBIfNotExists() {
  log('info', `Creating database ${POSTGRES_DB} because it did not exist.`);
  const tmpClient = knexLib({
    client: 'pg',
    connection: {
      host: POSTGRES_HOST,
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      database: 'postgres',
      port: POSTGRES_PORT
    },
    pool: { min: CONNECTION_POOL_MIN, max: CONNECTION_POOL_MAX }
  });

  // https://github.com/clay/amphora-storage-postgres/pull/7/files/16d3429767943a593ad9667b0d471fefc15088d3#diff-6a1e11a6146d3a5a01f955a44a2ac07a
  return tmpClient.raw('CREATE DATABASE ??', [POSTGRES_DB])
    .then(() => tmpClient.destroy())
    .then(connect);
}

/**
 * Connect to the DB. We need to do a quick check
 * to see if we're actually connected to the Clay
 * DB. If we aren't, connect to default and then
 * use that connection to create the Clay DB.
 *
 * @returns {Promise}
 */
function connect() {
  log('info', `Connecting to Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}`);

  knex = knexLib({
    client: 'pg',
    connection: {
      host: POSTGRES_HOST,
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
      database: POSTGRES_DB,
      port: POSTGRES_PORT
    },
    pool: { min: CONNECTION_POOL_MIN, max: CONNECTION_POOL_MAX }
  });

  // TODO: improve error catch! https://github.com/clay/amphora-storage-postgres/pull/7/files/16d3429767943a593ad9667b0d471fefc15088d3#diff-6a1e11a6146d3a5a01f955a44a2ac07a
  return knex.table('information_schema.tables').first()
    .catch(createDBIfNotExists);
}

function pullValFromRows(key, prop) {
  return (resp) => {
    if (!resp.length) return Promise.reject(notFoundError(key));

    // if the value is a list wrapped in an object, return the list
    if (isList(key)) return parseOrNot(resp[0][prop])._value;

    return resp[0][prop];
  };
}

function baseQuery(key) {
  const { schema, table } = findSchemaAndTable(key);

  if (!table) {
    const e = new Error(`Attempted to query for key ${key} without a table name`);

    log('warn', e.message, { stack: e.stack, action: 'postgres-base-query' });
  }

  return schema
    ? knex(table).withSchema(schema)
    : knex(table);
}

/**
 * Retrieve a single entry from the DB
 *
 * @param  {String} key
 * @return {Promise}
 */
function get(key) {
  const dataProp = 'data';

  return baseQuery(key)
    .select(dataProp)
    .where('id', key)
    .then(pullValFromRows(key, dataProp));
}

/**
 * columnToValueMap
 *
 * creates or adds to a map of column name -> value to be used in PUTs
 *
 * @param {String} column
 * @param {Object|String} value
 * @param {Object} obj
 * @returns {Object}
 */
function columnToValueMap(column, value, obj = {}) {
  obj[column] = value;

  return obj;
}

/**
 * Insert a row into the DB
 *
 * @param  {String} key
 * @param  {Object} value
 * @return {Promise}
 */
function put(key, value) {
  const { schema, table } = findSchemaAndTable(key),
    map = columnToValueMap('id', key); // create the value map

  // add data to the map
  columnToValueMap('data', wrapInObject(key, parseOrNot(value)), map);

  let url;

  if (isUri(key)) {
    url = decode(key.split('/_uris/').pop());

    // add url column to map if we're PUTting a uri
    columnToValueMap('url', url, map);
  }


  return onConflictPut(map, schema, table)
    .then(() => map.data);
}

/**
 * Returns a function that handles data patching based on the curried prop.
 * @param {String} prop
 * @return {Function}
 */
function patch(prop) {
  return (key, value) => {
    const { schema, table } = findSchemaAndTable(key);

    return raw('UPDATE ?? SET ?? = ?? || ? WHERE id = ?', [`${schema ? `${schema}.` : ''}${table}`, prop, prop, JSON.stringify(value), key]);
  };
}

/**
 * Given a key (id), data, which column that
 * data lives at, a schema and a table a `NO
 * CONFLICT` insert is executed
 *
 * TODO: BETTER COMMENT https://github.com/clay/amphora-storage-postgres/pull/7/files/16d3429767943a593ad9667b0d471fefc15088d3#diff-6a1e11a6146d3a5a01f955a44a2ac07a
 *
 * @param {Object} putObj
 * @param {String} schema
 * @param {String} table
 * @returns {Promise}
 */
function onConflictPut(putObj, schema, table) {
  var insert, update;

  if (schema) {
    insert = knex.withSchema(schema).table(table).insert(putObj);
  } else {
    insert = knex.table(table).insert(putObj);
  }

  update = knex.queryBuilder().update(putObj);

  return raw('? ON CONFLICT (id) DO ? returning *', [insert, update])
    .then(() => putObj);
}

/**
 * Insert a row into the DB
 *
 * @param  {String} key
 * @param  {Object} value
 * @return {Promise}
 */
function del(key) {
  return baseQuery(key)
    .where('id', key)
    .del();
}

/**
 * [batch description]
 * @param  {[type]} ops [description]
 * @return {[type]}     [description]
 */
function batch(ops) {
  var commands = [], url;

  for (let i = 0; i < ops.length; i++) {
    let { key, value } = ops[i],
      { table, schema } = findSchemaAndTable(key),
      map = columnToValueMap('id', key);

    columnToValueMap('data', wrapJSONStringInObject(key, value), map);

    // add url column to map if putting a uri
    if (isUri(key)) {
      url = decode(key.split('/_uris/').pop());

      columnToValueMap('url', url, map);
    }

    commands.push(onConflictPut(map, schema, table).then(() => map.data));
  }

  return Promise.all(commands);
}

/**
 * Return a readable stream of query results
 * from the db
 *
 * @param  {Object} options
 * @return {Stream}
 */
function createReadStream(options) {
  const { prefix, values, keys } = options,
    transform = TransformStream(options),
    selects = [];

  if (keys) selects.push('id');
  if (values) selects.push('data');

  baseQuery(prefix)
    .select(...selects)
    .where('id', 'like', `${prefix}%`)
    .pipe(transform);

  return transform;
}

/**
 * [putMeta description]
 * @param  {[type]} key   [description]
 * @param  {[type]} value [description]
 * @return {[type]}       [description]
 */
function getMeta(key) {
  return baseQuery(key)
    .select('meta')
    .where('id', key)
    .then(pullValFromRows(key, 'meta'));
}

/**
 * [putMeta description]
 * @param {String} key [description]
 * @param {Object} value [description]
 * @return {Promise} [description]
 */
function putMeta(key, value) {
  const { schema, table } = findSchemaAndTable(key),
    map = columnToValueMap('id', key);

  // add meta column to map
  columnToValueMap('meta', parseOrNot(value), map);

  return onConflictPut(map, schema, table).then(() => map.meta);
}

/**
 * Creates a table with the name that's
 * passed into the function. Table has
 * an `id` (text) and `data` (jsonb) columns
 *
 * @param {String} table
 * @returns {Promise}
 */
function createTable(table) {
  log('info', `Attempting to create table ${table}.`);
  return raw('CREATE TABLE IF NOT EXISTS ?? ( id TEXT PRIMARY KEY NOT NULL, data JSONB );', [table]);
}

/**
 * Creates a table with the name that's
 * passed into the function. Table has
 * an `id` (text), `data` (jsonb) column,
 * and `meta` (jsonb) columns
 *
 * @param {String} table
 * @returns {Promise}
 */
function createTableWithMeta(table) {
  log('info', `Attempting to create table ${table} with meta.`);
  return raw('CREATE TABLE IF NOT EXISTS ?? ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB );', [table]);
}

/**
 * Creates a Postgres schema with the
 * name passed into the function
 *
 * @param {String} name
 * @returns {Promise}
 */
function createSchema(name) {
  log('info', `Attempting to create schema ${name}.`);
  return raw('CREATE SCHEMA IF NOT EXISTS ??;', [name]);
}

/**
 * Executes a raw query against the database
 * @param {String} cmd
 * @param {Array<Any>} args
 * @return {Promise<Object>}
 */
function raw(cmd, args = []) {
  if (!Array.isArray(args)) throw new Error('`args` must be an array!');

  return knex.raw(cmd, args);
}

module.exports.connect = connect;
module.exports.put = put;
module.exports.get = get;
module.exports.del = del;
module.exports.raw = raw;
module.exports.patch = patch('data');
module.exports.plainPatch = patch;
module.exports.batch = batch;
module.exports.getMeta = getMeta;
module.exports.putMeta = putMeta;
module.exports.patchMeta = META_PUT_PATCH_FN;
module.exports.createReadStream = createReadStream;

// Knex methods
module.exports.createSchema = createSchema;
module.exports.createTable = createTable;
module.exports.createTableWithMeta = createTableWithMeta;

// Exposed for testing
module.exports.pullValFromRows = pullValFromRows;
module.exports.createDBIfNotExists = createDBIfNotExists;
module.exports.baseQuery = baseQuery;
module.exports.setClient = mock => knex = mock;
module.exports.setLog = mock => log = mock;
module.exports.onConflictPut = onConflictPut;
