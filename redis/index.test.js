'use strict';

var { createClient, get, put, batch, del, stubClient, formatValue } = require('./index'),
  redis = require('ioredis'),
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
    hmsetAsync: jest.fn(),
    hsetAsync: jest.fn(),
    hdelAsync: jest.fn(),
    hgetAsync: jest.fn()
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
      CLIENT.hsetAsync.mockResolvedValue('');
      return put(key, data)
        .then(() => expect(CLIENT.hsetAsync.mock.calls.length).toBe(resolution));
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
      CLIENT.hdelAsync.mockResolvedValue('');
      return del(key)
        .then(() => expect(CLIENT.hdelAsync.mock.calls.length).toBe(resolution));
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
      CLIENT.hgetAsync.mockResolvedValue(JSON.stringify(FAKE_DATA));
      return get('somekey')
        .then(() => {
          expect(CLIENT.hgetAsync.mock.calls.length).toBe(1);
        });
    });

    test('rejects with a NotFoundError if the key does not exist', () => {
      CLIENT.hgetAsync.mockResolvedValue(undefined);
      return get('somekey')
        .catch((err) => {
          expect(CLIENT.hgetAsync.mock.calls.length).toBe(1);
          expect(err.name).toEqual('NotFoundError');
        });
    });
  });

  describe('batch', () => {
    test('processes a batch of operations and writes them', () => {
      CLIENT.hmsetAsync.mockResolvedValue('');

      return batch(FAKE_OPS)
        .then(() => {
          expect(CLIENT.hmsetAsync.mock.calls.length).toBe(1);
        });
    });

    test('resolves quickly if the ops length is zero', () => {
      CLIENT.hmsetAsync.mockResolvedValue('');

      return batch([])
        .then(() => {
          expect(CLIENT.hmsetAsync.mock.calls.length).toBe(0);
        });
    });

    test('resolves if no ops pass the filter', () => {
      CLIENT.hmsetAsync.mockResolvedValue('');

      return batch([{
        key: 'foo.com/_components/bar',
        value: '{"foo": true}'
      }])
        .then(() => {
          expect(CLIENT.hmsetAsync.mock.calls.length).toBe(0);
        });
    });
  });

  describe('createClient', () => {
    test('creates a redis client if there is a redis url set', () => {
      redis.createClient = jest.fn();
      redis.createClient.mockReturnValue(CLIENT);

      return createClient('redis://localhost:6379')
        .then(resp => {
          expect(resp).toHaveProperty('server', 'redis://localhost:6379');
        });
    });

    test('throws if there is no redis url set', () => {
      return createClient()
        .catch(err => {
          expect(err).toHaveProperty('message', 'No Redis URL set');
        });
    });
  });

  describe('formatValue', () => {
    test('stringifies if you pass an object', () => {
      expect(formatValue(FAKE_DATA)).toBe(JSON.stringify(FAKE_DATA));
    });

    test('does not stringify if you pass a non-object value', () => {
      expect(formatValue(2)).toBe(2);
      expect(formatValue('test')).toBe('test');
      expect(formatValue(true)).toBe(true);
      expect(formatValue(undefined)).toBe(undefined);
      expect(formatValue(null)).toBe(null);
    });

    test('does not stringify if you pass an array', () => {
      expect(formatValue([])).toEqual([]);
    });
  });
});
