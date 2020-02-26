'use strict';

const { put, get, del, batch, createReadStream } = require('./db'),
  redis = require('../redis'),
  postgres = require('../postgres/client');

jest.mock('../redis');
jest.mock('../postgres/client');

describe('services/db', () => {
  const KEY = 'somekey',
    VALUE = { foo: true, bar: false },
    OPS = [{ key: KEY, value: JSON.stringify(VALUE) }];

  describe('get', () => {
    test('it calls postgres if cache is disabled', () => {
      postgres.get.mockResolvedValue(Promise.resolve());

      return get(KEY).then(() => {
        expect(postgres.get.mock.calls.length).toBe(1);
      });
    });

    test('it calls redis if cache is enabled', () => {
      redis.get.mockResolvedValue(JSON.stringify(VALUE));

      return get(KEY, true).then(() => {
        expect(redis.get).toHaveBeenCalledWith(KEY);
        expect(redis.get.mock.calls.length).toBe(1);
        expect(postgres.get.mock.calls.length).toBe(0);
      });
    });

    test('it does not call Postgres client if Redis has the data and cache is enabled', () => {
      redis.get.mockResolvedValue(JSON.stringify(VALUE));

      return get(KEY, true).then(() => {
        expect(redis.get.mock.calls.length).toBe(1);
        expect(redis.get).toHaveBeenCalledWith(KEY);
        expect(postgres.get.mock.calls.length).toBe(0);
      });
    });

    test('it does not try to parse a uri response', () => {
      const uri = 'foo.com/_uris/bar',
        page = 'foo.com/_pages/bar';

      redis.get.mockResolvedValue(page);

      return get(uri, true).then(resp => {
        expect(redis.get.mock.calls.length).toBe(1);
        expect(redis.get).toHaveBeenCalledWith(uri);
        expect(resp).toBe(page);
        expect(postgres.get.mock.calls.length).toBe(0);
      });
    });

    test('it does not encode uri string as json in Redis on GET', () => {
      const uri = 'foo.com/_uris/bar',
        page = 'foo.com/_pages/bar';

      redis.get.mockResolvedValue(Promise.reject());
      postgres.get.mockResolvedValue(Promise.resolve(page));
      redis.put.mockResolvedValue(Promise.resolve());

      return get(uri, true).then(() => {
        expect(redis.get.mock.calls.length).toBe(1);
        expect(redis.put).toHaveBeenCalledWith(uri, page);
      });
    });


    test('it calls Postgres client if Redis does not have the data, saves result to Redis', () => {
      redis.get.mockResolvedValue(Promise.reject());
      postgres.get.mockResolvedValue(Promise.resolve(VALUE));
      redis.put.mockResolvedValue(Promise.resolve());

      return get(KEY, true).then(() => {
        expect(redis.get.mock.calls.length).toBe(1);
        expect(postgres.get.mock.calls.length).toBe(1);
        expect(redis.get).toHaveBeenCalledWith(KEY);
        expect(postgres.get).toHaveBeenCalledWith(KEY);
        expect(redis.put).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE));
      });
    });

    test('it calls Postgres client if Redis does not have the data, still returns on PUT error', () => {
      redis.get.mockResolvedValue(Promise.reject());
      postgres.get.mockResolvedValue(Promise.resolve(VALUE));
      redis.put.mockResolvedValue(Promise.reject());

      return get(KEY, true).then(() => {
        expect(redis.get.mock.calls.length).toBe(1);
        expect(postgres.get.mock.calls.length).toBe(1);
        expect(redis.get).toHaveBeenCalledWith(KEY);
        expect(postgres.get).toHaveBeenCalledWith(KEY);
        expect(redis.put).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE));
      });
    });
  });

  describe('put', () => {
    test('it calls the `put` method for both Redis and Postgres', () => {
      redis.put.mockResolvedValue(Promise.resolve());
      postgres.put.mockResolvedValue(Promise.resolve());

      return put(KEY, VALUE, true).then(() => {
        expect(redis.put.mock.calls.length).toBe(1);
        expect(postgres.put.mock.calls.length).toBe(1);
        expect(redis.put).toHaveBeenCalledWith(KEY, VALUE);
        expect(postgres.put).toHaveBeenCalledWith(KEY, VALUE);
      });
    });

    test('it only calls `put` method for Postgres if cache is disabled', () => {
      postgres.put.mockResolvedValue(Promise.resolve());

      return put(KEY, VALUE, false).then(() => {
        expect(redis.put.mock.calls.length).toBe(0);
        expect(postgres.put.mock.calls.length).toBe(1);
        expect(postgres.put).toHaveBeenCalledWith(KEY, VALUE);
      });
    });
  });

  describe('del', () => {
    test('it calls the `del` method for both Redis and Postgres', () => {
      redis.del.mockResolvedValue(Promise.resolve());
      postgres.del.mockResolvedValue(Promise.resolve());

      return del(KEY).then(() => {
        expect(redis.del.mock.calls.length).toBe(1);
        expect(postgres.del.mock.calls.length).toBe(1);
        expect(redis.del).toHaveBeenCalledWith(KEY);
        expect(postgres.del).toHaveBeenCalledWith(KEY);
      });
    });
  });

  describe('batch', () => {
    test('it calls the `batch` method for both Redis and Postgres', () => {
      redis.batch.mockResolvedValue(Promise.resolve());
      postgres.batch.mockResolvedValue(Promise.resolve());

      return batch(OPS, true).then(() => {
        expect(redis.batch.mock.calls.length).toBe(1);
        expect(postgres.batch.mock.calls.length).toBe(1);
        expect(redis.batch).toHaveBeenCalledWith(OPS);
        expect(postgres.batch).toHaveBeenCalledWith(OPS);
      });
    });

    test('it calls the `batch` method for only Postgres if cache is not enabled', () => {
      postgres.batch.mockResolvedValue(Promise.resolve());

      return batch(OPS, false).then(() => {
        expect(redis.batch.mock.calls.length).toBe(0);
        expect(postgres.batch.mock.calls.length).toBe(1);
        expect(postgres.batch).toHaveBeenCalledWith(OPS);
      });
    });
  });

  describe('createReadStream', () => {
    test('it calls the `createReadStream` method only Postgres', () => {
      createReadStream();
      expect(postgres.createReadStream.mock.calls.length).toBe(1);
    });
  });
});
