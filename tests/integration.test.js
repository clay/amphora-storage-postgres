'use strict';
const uuid = require('uuid'),
  cases = [
    { cache: false, published: false },
    { cache: false, published: true },
    { cache: true, published: false },
    { cache: true, published: true }
  ];

function mockEnv() {
  return {
    CLAY_STORAGE_POSTGRES_USER: 'postgres',
    CLAY_STORAGE_POSTGRES_PASSWORD: '',
    CLAY_STORAGE_POSTGRES_HOST: 'localhost',
    CLAY_STORAGE_POSTGRES_PORT: '5432',
    CLAY_STORAGE_POSTGRES_DB: uuid.v4(),
    CLAY_STORAGE_POSTGRES_CACHE_HOST: 'redis://localhost:6379'
  };
}

describe('integration tests', () => {
  const userEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = mockEnv();
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = userEnv;
  });

  test.each(cases)('will PUT, GET, and DEL succesfully (%p)', async (testcase) => {
    console.log(`Testing PUT/GET/DEL with cache=${testcase.cache} publish=${testcase.published}`);
    const db  = require('../index.js'),
      postgres = require('../postgres/client'),
      redis = require('../redis'),
      key = testcase.published ? '/_pages/foo/bar@published' : '/_pages/foo/bar',
      val = { test: true };

    await db.setup(testcase.cache);
    await expect(db.put(key, val, testcase.cache)).resolves.toEqual(val);
    await expect(db.get(key, testcase.cache)).resolves.toEqual(val);

    // Code Smell: The fact that the 'redis' class returns a string instead
    // of an object means that the generic class needs to be aware of
    // the implementation of each of the specific classes via conditionals.
    if (testcase.cache && testcase.published) {
      await expect(redis.get(key)).resolves.toEqual(JSON.stringify(val));
    } else {
      await expect(redis.get(key)).rejects.toThrow();
    }

    await expect(postgres.get(key)).resolves.toEqual(val);
    await expect(db.del(key, testcase.cache)).resolves.toEqual(1);
    await expect(db.get(key, testcase.cache)).rejects.toThrow();
  });

  test.each(cases)('will BATCH succesfully (%p)', async (testcase) => {
    console.log(`Testing BATCH with cache=${testcase.cache} publish=${testcase.published}`);
    const db  = require('../index.js'),
      postgres = require('../postgres/client'),
      redis = require('../redis'),
      keys = [
        testcase.published ? '/_pages/foo/a@published' : '/_pages/foo/a',
        testcase.published ? '/_pages/foo/b@published' : '/_pages/foo/b',
        testcase.published ? '/_pages/foo/c@published' : '/_pages/foo/c',
        testcase.published ? '/_uris/foo@published' : '/_uris/foo'
      ],
      vals = [
        { test: true },
        { test: false },
        { test: [1 ,2 ,3] },
        'example.com/foo'
      ],
      batch = keys.map((k, i) => ({ key: k, value: vals[i] }));
    await db.setup(testcase.cache);
    await expect(db.batch(batch, testcase.cache)).resolves.toEqual(vals);

    for (let i = 0; i < batch.length; i++) {
      let key = batch[i].key, val = batch[i].value,
        expectStr = typeof val === 'string';  // used to test that strings are not re-encoded.

      await expect(db.get(key, testcase.cache)).resolves.toEqual(val);
      if (testcase.cache && (testcase.published || expectStr)) {
        await expect(redis.get(key)).resolves.toEqual(expectStr ? val : JSON.stringify(val));
      } else {
        await expect(redis.get(key)).rejects.toThrow();
      }
      await expect(postgres.get(key)).resolves.toEqual(val);
      await expect(db.del(key, testcase.cache)).resolves.toEqual(1);
      await expect(db.get(key, testcase.cache)).rejects.toThrow();
    }
  });
});
