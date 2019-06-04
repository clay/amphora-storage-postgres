'use strict';

const client = require('./client'),
  knex = require('knex'),
  TransformStream = require('../services/list-transform-stream'),
  { POSTGRES_DB } = require('../services/constants'),
  { decode } = require('../services/utils');

jest.mock('knex');
jest.mock('../services/list-transform-stream');

describe('postgres/client', () => {
  describe('createDBIfNotExists', () => {
    test('connects to the default db in order to create the clay one', () => {
      const destroy = jest.fn(() => Promise.resolve({})),
        first = jest.fn(() => Promise.resolve({})),
        raw = jest.fn(() => Promise.resolve({})),
        table = jest.fn(() => ({ first }));

      knex
        .mockReturnValueOnce({ raw, destroy })
        .mockReturnValueOnce({ table });

      return client.createDBIfNotExists().then(() => {
        expect(knex.mock.calls.length).toBe(2);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('CREATE DATABASE ??');
        expect(raw.mock.calls[0][1]).toEqual([POSTGRES_DB]);
        expect(destroy.mock.calls.length).toBe(1);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe('information_schema.tables');
      });
    });
  });

  describe('connect', () => {
    test('the client connects method is called', () => {
      const first = jest.fn(() => Promise.resolve({})),
        table = jest.fn(() => ({ first }));

      knex.mockReturnValueOnce({ table });

      return client.connect().then(() => {
        expect(knex.mock.calls.length).toBe(1);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe('information_schema.tables');
      });
    });
  });

  describe('pullValFromRows', () => {
    test('get a prop from a db row if there is a value', () => {
      const key = 'nymag.com/_components/author-feed/instances/new',
        response = [
          {
            id: 'some id',
            data: 'some data'
          }
        ],
        partialFunction = client.pullValFromRows(key, 'data');

      expect(partialFunction(response)).toBe(response[0].data);
    });

    test('rejects if there is no rows in the response', () => {
      const key = 'nymag.com/_components/author-feed/instances/new',
        response = [],
        partialFunction = client.pullValFromRows(key, 'data');

      return partialFunction(response).catch(error => expect(error.key).toMatch(key));
    });

    test('unwraps wrapped data if the value is a list', () => {
      const key = 'nymag.com/_lists/authors',
        response = [{
          id: 'id123',
          data: {
            _value: [ { name: 'Author One' } ]
          }
        }],
        partialFunction = client.pullValFromRows(key, 'data');

      expect(partialFunction(response)).toEqual([{ name: 'Author One' }]);
    });
  });

  describe.each([
    ['nymag.com/_layouts/layout-column/someinstance', 1, 1, 'layout-column'],
    ['nymag.com/_pages/bnltYWcuY29tL2F1dGhvci9BYnJhaGFtJTIwUmllc21hbi8', 1, 0, 'pages'],
    ['nymag.com/_nontable', 1, 0, undefined]
  ])
  ('baseQuery', (key, knexCalls, schemaCalls, knexParam) => {
    test('creates a base query with/without schema from a key', () => {
      const withSchema = jest.fn(),
        knex = jest.fn(() => ({ withSchema }));

      client.setClient(knex);
      client.baseQuery(key);

      expect(knex.mock.calls.length).toBe(knexCalls);
      expect(knex.mock.calls[0][0]).toBe(knexParam);
      expect(withSchema.mock.calls.length).toBe(schemaCalls);
    });

    test('logs a warning if key doesn\'t correspond to an existing table', () => {
      const withSchema = jest.fn(),
        knex = jest.fn(() => ({ withSchema })),
        mockLog = jest.fn();

      client.setLog(mockLog);
      client.setClient(knex);
      client.baseQuery(key);

      if (key === 'nymag.com/_nontable') {
        expect(mockLog.mock.calls.length).toBe(1);
        expect(mockLog.mock.calls[0][0]).toBe('warn');
      } else {
        expect(mockLog.mock.calls.length).toBe(0);
      }
    });
  });

  describe('get', () => {
    const queryResult = [
        {
          data: {
            someData: ''
          }
        }
      ],
      where = jest.fn(() => Promise.resolve(queryResult)),
      select = jest.fn(() => ({ where })),
      from = jest.fn(() => ({ select })),
      withSchema = jest.fn(() => ({ select }));

    test('gets the data column of a row from the database by an id', () => {
      const key = 'nymag.com/_layouts/layout-column/someinstance',
        knexMock = jest.fn(() => ({ from, withSchema, select }));

      client.setClient(knexMock);

      return client.get(key).then((data) => {
        expect(select.mock.calls.length).toBe(1);
        expect(select.mock.calls[0][0]).toBe('data');
        expect(where.mock.calls.length).toBe(1);
        expect(where.mock.calls[0][0]).toBe('id');
        expect(where.mock.calls[0][1]).toBe(key);
        expect(withSchema.mock.calls.length).toBe(1);
        expect(data).toEqual(queryResult[0].data);
      });
    });

    test('gets the data column of a row from the database by an id of an uri', () => {
      const key = 'nymag.com/_uris/someinstance',
        knexMock = jest.fn(() => ({ from, withSchema, select }));

      client.setClient(knexMock);

      return client.get(key).then((data) => {
        expect(select.mock.calls.length).toBe(1);
        expect(select.mock.calls[0][0]).toBe('data');
        expect(where.mock.calls.length).toBe(1);
        expect(where.mock.calls[0][0]).toBe('id');
        expect(where.mock.calls[0][1]).toBe(key);
        expect(data).toEqual(queryResult[0].data);
      });
    });
  });

  describe('getMeta', () => {
    const key = 'nymag.com/_layouts/layout-column/someinstance',
      queryResult = [
        {
          data: {
            someData: ''
          },
          meta: {
            someMeta: ''
          }
        }
      ],
      where = jest.fn(() => Promise.resolve(queryResult)),
      select = jest.fn(() => ({ where })),
      withSchema = jest.fn(() => ({ select })),
      knex = jest.fn(() => ({ withSchema, select }));

    test('gets the meta column of a row from the database by a id', () => {
      client.setClient(knex);

      return client.getMeta(key).then((data) => {
        expect(knex.mock.calls.length).toBe(1);
        expect(select.mock.calls.length).toBe(1);
        expect(select.mock.calls[0][0]).toBe('meta');
        expect(where.mock.calls.length).toBe(1);
        expect(where.mock.calls[0][0]).toBe('id');
        expect(where.mock.calls[0][1]).toBe(key);
        expect(data).toEqual(queryResult[0].meta);
      });
    });
  });

  describe('raw', () => {
    test('runs a raw query in the database', () => {
      const sql = 'some sql',
        args = [1, 2, 3],
        raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      return client.raw(sql, args).then(() => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe(sql);
        expect(raw.mock.calls[0][1]).toEqual(args);
      });
    });

    test('runs a raw query in the database when no args are passed', () => {
      const sql = 'some sql',
        raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      return client.raw(sql).then(() => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe(sql);
      });
    });

    test('fails if args are not an array', () => {
      const raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      expect(client.raw.bind(null, 'some sql', 2)).toThrow('`args` must be an array!');
      expect(raw.mock.calls.length).toBe(0);
    });
  });

  describe('del', () => {
    const key = 'nymag.com/_layouts/layout-column/someinstance',
      where = jest.fn(() => ({ del })),
      del = jest.fn(() => Promise.resolve({})),
      withSchema = jest.fn(() => ({ where })),
      knex = jest.fn(() => ({ withSchema, where }));

    test('deletes a row from the database by an id', () => {
      client.setClient(knex);

      return client.del(key).then(() => {
        expect(knex.mock.calls.length).toBe(1);
        expect(where.mock.calls.length).toBe(1);
        expect(where.mock.calls[0][0]).toBe('id');
        expect(where.mock.calls[0][1]).toBe(key);
        expect(del.mock.calls.length).toBe(1);
      });
    });
  });

  describe('createSchema', () => {
    test('create a schema in the database', () => {
      const args = 'schemaname',
        raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      return client.createSchema(args).then(() => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('CREATE SCHEMA IF NOT EXISTS ??;');
        expect(raw.mock.calls[0][1]).toEqual([args]);
      });
    });
  });

  describe('createTableWithMeta', () => {
    test('creates a table with meta column in the database', () => {
      const args = 'tablename',
        raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      return client.createTableWithMeta(args).then(() => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('CREATE TABLE IF NOT EXISTS ?? ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB );');
        expect(raw.mock.calls[0][1]).toEqual([args]);
      });
    });
  });

  describe('createTable', () => {
    test('creates a table in the database', () => {
      const args = 'tablename',
        raw = jest.fn(() => Promise.resolve({}));

      client.setClient({ raw });

      return client.createTable(args).then(() => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('CREATE TABLE IF NOT EXISTS ?? ( id TEXT PRIMARY KEY NOT NULL, data JSONB );');
        expect(raw.mock.calls[0][1]).toEqual([args]);
      });
    });
  });

  describe('onConflictPut', () => {
    const update = jest.fn(() => 'update sql'),
      insert = jest.fn(() => 'insert sql'),
      table = jest.fn(() => ({ insert })),
      withSchema = jest.fn(() => ({ table })),
      queryBuilder = jest.fn(() => ({ update })),
      raw = jest.fn(() => Promise.resolve({})),
      knex = {
        withSchema,
        table,
        raw,
        queryBuilder
      };

    test('handle insertion conflicts when inserting having a schema in the sql statement', () => {
      const id = 'nymag.com/_layouts/layout-column/someinstance',
        data = {
          someText: '',
          someOtherText: ''
        },
        schema = 'someschema',
        tableName = 'sometable',
        putObj = { id, data };

      client.setClient(knex);

      return client.onConflictPut(putObj, schema, tableName).then((data) => {
        expect(withSchema.mock.calls.length).toBe(1);
        expect(withSchema.mock.calls[0][0]).toBe(schema);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual(putObj);
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });

    test('handle insertion conflicts when inserting without having a schema in the sql statement', () => {
      const id = 'nymag.com/_layouts/layout-column/someinstance',
        data = {
          someText: '',
          someOtherText: ''
        },
        tableName = 'sometable',
        putObj = { id, data };

      client.setClient(knex);

      return client.onConflictPut(putObj, null, tableName).then((data) => {
        expect(withSchema.mock.calls.length).toBe(0);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual(putObj);
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });
  });

  describe('patch', () => {
    const mockResult = {
        rows: [],
        rowCount: 1
      },
      raw = jest.fn(() => Promise.resolve(mockResult)),
      knex = { raw };

    beforeEach(() => {
      client.setClient(knex);
    });

    test('patches a row in the database', () => {
      const key = 'nymag.com/_layouts/layout-column/someinstance',
        value = {
          id: 'some id',
          data: 'some data'
        },
        schema = 'layouts',
        table = 'layout-column';

      return client.plainPatch('data')(key, value).then((data) => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('UPDATE ?? SET ?? = ?? || ? WHERE id = ?');
        expect(raw.mock.calls[0][1]).toEqual([`${schema}.${table}`, 'data', 'data', JSON.stringify(value), key]);
        expect(data).toEqual(mockResult);
      });
    });

    test('patches a row in the database', () => {
      const key = 'nymag.com/_layouts/layout-column/someinstance',
        value = {
          id: 'some id',
          data: 'some data'
        },
        schema = 'layouts',
        table = 'layout-column';

      return client.patch(key, value).then((data) => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('UPDATE ?? SET ?? = ?? || ? WHERE id = ?');
        expect(raw.mock.calls[0][1]).toEqual([`${schema}.${table}`, 'data', 'data', JSON.stringify(value), key]);
        expect(data).toEqual(mockResult);
      });
    });

    test('patches a row in the database table without schema', () => {
      const key = 'nymag.com/_pages/page-1',
        value = {
          id: 'some id',
          data: 'some data'
        },
        table = 'pages';

      return client.patch(key, value).then((data) => {
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('UPDATE ?? SET ?? = ?? || ? WHERE id = ?');
        expect(raw.mock.calls[0][1]).toEqual([`${table}`, 'data', 'data', JSON.stringify(value), key]);
        expect(data).toEqual(mockResult);
      });
    });
  });

  describe('createReadStream', () => {
    const pipe = jest.fn(() => ({})),
      where = jest.fn(() => ({ pipe })),
      select = jest.fn(() => ({ where })),
      withSchema = jest.fn(() => ({ select })),
      knex = jest.fn(() => ({
        withSchema,
        select
      })),
      mockedTransform = {};

    beforeEach(() => {
      client.setClient(knex);
    });

    test('creates a read stream of query results with id and data columns', () => {
      TransformStream.mockReturnValueOnce(mockedTransform);

      const options = {
          prefix: 'nymag.com/_uris',
          values: true,
          keys: true
        },
        transform = client.createReadStream(options);

      expect(withSchema.mock.calls.length).toBe(0);
      expect(select.mock.calls.length).toBe(1);
      expect(select.mock.calls[0][0]).toBe('id');
      expect(select.mock.calls[0][1]).toBe('data');
      expect(where.mock.calls.length).toBe(1);
      expect(where.mock.calls[0][1]).toBe('like');
      expect(where.mock.calls[0][2]).toBe(`${options.prefix}%`);
      expect(transform).toBe(mockedTransform);
    });

    test('creates a read stream of query results without id and data columns', () => {
      TransformStream.mockReturnValueOnce(mockedTransform);

      const options = {
          prefix: 'nymag.com/_uris',
          values: false,
          keys: false
        },
        transform = client.createReadStream(options);

      expect(withSchema.mock.calls.length).toBe(0);
      expect(select.mock.calls.length).toBe(1);
      expect(select.mock.calls[0][0]).toBe(undefined);
      expect(where.mock.calls.length).toBe(1);
      expect(where.mock.calls[0][1]).toBe('like');
      expect(where.mock.calls[0][2]).toBe(`${options.prefix}%`);
      expect(transform).toBe(mockedTransform);
    });
  });

  describe('put', () => {
    const update = jest.fn(() => 'update sql'),
      insert = jest.fn(() => 'insert sql'),
      table = jest.fn(() => ({ insert })),
      withSchema = jest.fn(() => ({ table })),
      queryBuilder = jest.fn(() => ({ update })),
      raw = jest.fn(() => Promise.resolve({})),
      knex = {
        withSchema,
        table,
        raw,
        queryBuilder
      },
      data = {
        someText: '',
        someOtherText: ''
      };

    test('inserts a row into the database', () => {
      const key = 'nymag.com/_layouts/layout-column/someinstance',
        tableName = 'layout-column';

      client.setClient(knex);

      return client.put(key, data).then((data) => {
        expect(withSchema.mock.calls.length).toBe(1);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual({ id: key, data });
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });

    test('inserts a row into the database', () => {
      const key = 'nymag.com/_lists/some-list/someinstance',
        tableName = 'lists';

      client.setClient(knex);

      return client.put(key, data).then((data) => {
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual({ id: key, data });
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });

    test('inserts a row with a column for url if passed a uri', () => {
      const key = 'nymag.com/_uris/aHR0cDovL3NpdGUuY29tL3NvbWUtY29vbC11cmw=',
        tableName = 'uris';

      client.setClient(knex);

      return client.put(key, data).then((data) => {
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual({ id: key, data, url: 'http://site.com/some-cool-url' });
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });

    test('inserts a row with a column for site id', () => {
      const key = 'nymag.com/_pages/sample-article',
        tableName = 'pages',
        putData = { data, siteSlug: 'nymag' };

      client.setClient(knex);

      return client.put(key, putData).then((data) => {
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual({ id: key, data, site_id: 'nymag' });
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(putData.data).toEqual(data);
      });
    });
  });

  describe('putMeta', () => {
    test('inserts a row into the database', () => {
      const update = jest.fn(() => 'update sql'),
        insert = jest.fn(() => 'insert sql'),
        table = jest.fn(() => ({ insert })),
        withSchema = jest.fn(() => ({ table })),
        queryBuilder = jest.fn(() => ({ update })),
        raw = jest.fn(() => Promise.resolve({})),
        knex = {
          withSchema,
          table,
          raw,
          queryBuilder
        },
        key = 'nymag.com/_layouts/layout-column/someinstance',
        meta = {
          someText: '',
          someOtherText: ''
        },
        tableName = 'layout-column';

      client.setClient(knex);

      return client.putMeta(key, meta).then((data) => {
        expect(withSchema.mock.calls.length).toBe(1);
        expect(table.mock.calls.length).toBe(1);
        expect(table.mock.calls[0][0]).toBe(tableName);
        expect(insert.mock.calls.length).toBe(1);
        expect(insert.mock.calls[0][0]).toEqual({ id: key, meta });
        expect(queryBuilder.mock.calls.length).toBe(1);
        expect(update.mock.calls.length).toBe(1);
        expect(raw.mock.calls.length).toBe(1);
        expect(raw.mock.calls[0][0]).toBe('? ON CONFLICT (id) DO ? returning *');
        expect(raw.mock.calls[0][1]).toEqual(['insert sql', 'update sql']);
        expect(data).toEqual(data);
      });
    });
  });

  describe('batch', () => {
    test('batches inserts into the database', () => {
      const update = jest.fn(() => 'update sql'),
        insert = jest.fn(() => 'insert sql'),
        table = jest.fn(() => ({ insert })),
        withSchema = jest.fn(() => ({ table })),
        queryBuilder = jest.fn(() => ({ update })),
        raw = jest.fn(() => Promise.resolve({})),
        knex = {
          withSchema,
          table,
          raw,
          queryBuilder
        },
        tableName = 'layout-column',
        ops = [
          {
            key: 'nymag.com/_layouts/layout-column/someinstance',
            value: {
              someText: '',
              someOtherText: ''
            }
          },
          {
            key: 'nymag.com/_layouts/layout-column/someotherinstance',
            value: {
              someText: '',
              someOtherText: ''
            }
          }
        ];

      client.setClient(knex);

      return client.batch(ops).then((results) => {
        expect(withSchema.mock.calls.length).toBe(2);
        expect(table.mock.calls.length).toBe(2);
        expect(insert.mock.calls.length).toBe(2);
        expect(queryBuilder.mock.calls.length).toBe(2);
        expect(update.mock.calls.length).toBe(2);
        expect(raw.mock.calls.length).toBe(2);

        for (let index = 0; index < results.length; index++) {
          expect(table.mock.calls[index][0]).toBe(tableName);
          expect(insert.mock.calls[index][0]).toEqual({ id: ops[index].key, data: results[index] });
          expect(raw.mock.calls[index][0]).toBe('? ON CONFLICT (id) DO ? returning *');
          expect(raw.mock.calls[index][1]).toEqual(['insert sql', 'update sql']);
        }
      });
    });

    test('batches inserts of uris into the database', () => {
      const update = jest.fn(() => 'update sql'),
        insert = jest.fn(() => 'insert sql'),
        table = jest.fn(() => ({ insert })),
        withSchema = jest.fn(() => ({ table })),
        queryBuilder = jest.fn(() => ({ update })),
        raw = jest.fn(() => Promise.resolve({})),
        knex = {
          withSchema,
          table,
          raw,
          queryBuilder
        },
        ops = [
          {
            key: 'nymag.com/_uris/someinstance',
            value: { data: 'nymag.com/_pages/someinstance', siteSlug: 'nymag' }
          },
          {
            key: 'nymag.com/_uris/someotherinstance',
            value: { data: 'nymag.com/_pages/someotherinstance', siteSlug: 'nymag' }
          }
        ];

      client.setClient(knex);

      return client.batch(ops).then((results) => {
        expect(withSchema.mock.calls.length).toBe(0);
        expect(table.mock.calls.length).toBe(2);
        expect(insert.mock.calls.length).toBe(2);
        expect(queryBuilder.mock.calls.length).toBe(2);
        expect(update.mock.calls.length).toBe(2);
        expect(raw.mock.calls.length).toBe(2);

        for (let index = 0; index < results.length; index++) {
          expect(table.mock.calls[index][0]).toBe('uris');
          expect(insert.mock.calls[index][0]).toEqual({ id: ops[index].key, data: results[index], url: decode(ops[index].key.split('/_uris/').pop()), site_id: 'nymag' });
          expect(raw.mock.calls[index][0]).toBe('? ON CONFLICT (id) DO ? returning *');
          expect(raw.mock.calls[index][1]).toEqual(['insert sql', 'update sql']);
        }
      });
    });
  });
});
