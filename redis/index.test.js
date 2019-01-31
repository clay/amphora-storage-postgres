'use strict';

var { createClient, get, put, batch, del, stubClient } = require('./index'),
  Redis = require('ioredis'),
  FAKE_DATA = { foo: true, bar: true },
  FAKE_OPS = [
    {
      key: 'foo.com/_components/bar',
      value: '{"foo": true}'
    },
    {
      key: 'foo.com/_components/bar@published',
      value: '{"foo": true}'
    },
    {
      key: 'foo.com/_uris/bar',
      value: 'somestring'
    }
  ],
  CLIENT = {
    on: jest.fn(),
    hmset: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hget: jest.fn()
  };

beforeEach(() => {
  stubClient(CLIENT);
});

describe('redis', () => {
  describe.each([
    ['non-published components', 'site.com/_components/cmpt/instances/foo', FAKE_DATA, 0],
    ['published components', 'site.com/_components/cmpt/instances/foo@published', FAKE_DATA, 1],
    ['non-published pages', 'site.com/_pages/foo', FAKE_DATA, 0],
    ['published pages', 'site.com/_pages/foo@published', FAKE_DATA, 1],
    ['lists', 'site.com/_lists/foo', FAKE_DATA, 0],
    ['uris', 'site.com/_uris/foo', FAKE_DATA, 1],
    ['users', 'site.com/_users/foo', FAKE_DATA, 1]
  ])
  ('put', (val, key, data, resolution) => {
    test(`does ${resolution ? '' : 'not '}put ${val} to Redis`, () => {
      CLIENT.hset.mockResolvedValue('');
      return put(key, data)
        .then(() => expect(CLIENT.hset.mock.calls.length).toBe(resolution));
    });
  });

  describe.each([
    ['non-published components', 'site.com/_components/cmpt/instances/foo', 0],
    ['published components', 'site.com/_components/cmpt/instances/foo@published', 1],
    ['non-published pages', 'site.com/_pages/foo', 0],
    ['published pages', 'site.com/_pages/foo@published', 1],
    ['lists', 'site.com/_lists/foo', 0],
    ['uris', 'site.com/_uris/foo', 1],
    ['users', 'site.com/_users/foo', 1]
  ])
  ('del', (val, key, resolution) => {
    test(`does ${resolution ? '' : 'not '}del ${val} from Redis`, () => {
      CLIENT.hdel.mockResolvedValue('');
      return del(key)
        .then(() => expect(CLIENT.hdel.mock.calls.length).toBe(resolution));
    });
  });

  describe('get', () => {
    test('Rejects with a NotFoundError if there is no redis client', () => {
      stubClient();

      return get('someKey')
        .catch((err) => {
          expect(err.name).toEqual('NotFoundError');
        });
    });

    test('retrieves data from Redis', () => {
      CLIENT.hget.mockResolvedValue(JSON.stringify(FAKE_DATA));
      return get('somekey')
        .then(() => {
          expect(CLIENT.hget.mock.calls.length).toBe(1);
        });
    });

    test('rejects with a NotFoundError if the key does not exist', () => {
      CLIENT.hget.mockResolvedValue(undefined);
      return get('somekey')
        .catch((err) => {
          expect(CLIENT.hget.mock.calls.length).toBe(1);
          expect(err.name).toEqual('NotFoundError');
        });
    });
  });

  describe('batch', () => {
    test('processes a batch of operations and writes them', () => {
      CLIENT.hmset.mockResolvedValue('');

      return batch(FAKE_OPS)
        .then(() => {
          expect(CLIENT.hmset.mock.calls.length).toBe(1);
        });
    });

    test('resolves quickly if the ops length is zero', () => {
      CLIENT.hmset.mockResolvedValue('');

      return batch([])
        .then(() => {
          expect(CLIENT.hmset.mock.calls.length).toBe(0);
        });
    });

    test('resolves if no ops pass the filter', () => {
      CLIENT.hmset.mockResolvedValue('');

      return batch([{
        key: 'foo.com/_components/bar',
        value: '{"foo": true}'
      }])
        .then(() => {
          expect(CLIENT.hmset.mock.calls.length).toBe(0);
        });
    });
  });

  describe('createClient', () => {
    test('creates a Redis client for a single node', () => {
      return createClient('redis://localhost:6379')
        .then(resp => {
          expect(resp).toHaveProperty('server', 'redis://localhost:6379');
        });
    });

    test('creates a Redis cluster client', () => {
      return createClient(false, 'redis://localhost:6379,redis://localhost:6379')
        .then(resp => {
          expect(resp).toHaveProperty('server', 'redis://localhost:6379,redis://localhost:6379');
        });
    });

    test('creates a Redis cluster client with a list of host:port', () => {
      return createClient(false, 'localhost:6379,localhost:6379')
        .then(resp => {
          expect(resp).toHaveProperty('server', 'localhost:6379,localhost:6379');
        });
    });

    test('creates a Redis cluster client with a list of host', () => {
      return createClient(false, 'localhost,localhost')
        .then(resp => {
          expect(resp).toHaveProperty('server', 'localhost,localhost');
        });
    });

    test('throws if there is no redis host or cluster host(s) url set', () => {
      return createClient()
        .catch(err => {
          expect(err).toHaveProperty('message', 'No redis host or cluster host(s) defined');
        });
    });

    test('calls the internal `connect` method for the ioredis Redis Client', () => {
      Redis.prototype.connect = jest.fn();
      Redis.prototype.connect.mockResolvedValue(true);

      return createClient('redis://localhost:6379')
        .then(resp => {
          expect(Redis.prototype.connect).toHaveBeenCalled();
          expect(resp).toHaveProperty('server', 'redis://localhost:6379');
        });
    });
  });
});
