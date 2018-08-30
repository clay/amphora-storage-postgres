'use strict';

const { parseOrNot, findSchemaAndTable } = require('./utils');

describe('services/utils', () => {
  const testObj = { foo: true, bar: false },
    stringifiedTestObj = JSON.stringify(testObj);

  describe('parseOrNot', () => {
    test('it parses stringified JSON objects', () => {
      expect(parseOrNot(stringifiedTestObj)).toMatchObject(testObj);
    });

    test('it does not error when trying to parse a non-JSON value', () => {
      expect(parseOrNot('foobar')).toStrictEqual('foobar');
    });
  });

  describe.each([
    ['nymag.com/_components/follow/instances/facebook', 'components', 'follow'],
    ['nymag.com/_layouts/layout-column/instances/someinstance', 'layouts', 'layout-column'],
    ['nymag.com/_pages/bnltYWcuY29tL2F1dGhvci9BYnJhaGFtJTIwUmllc21hbi8', undefined, 'pages'],
    ['nymag.com/_lists/some-list/bnltYWcuY29tL2F1dGhvci9BYnJhaGFtJTIwUmllc21hbi8', undefined, 'lists'],
    ['nymag.com/_users/bnltYWcuY29tL2F1dGhvci9BYnJhaGFtJTIwUmllc21hbi8', undefined, 'users'],
  ])
  ('findSchemaAndTable', (key, expectedSchema, expectedTable) => {
    test(`gets schema and table from a ${expectedTable} key`, () => {
      const { schema, table } = findSchemaAndTable(key);

      expect(schema).toBe(expectedSchema);
      expect(table).toBe(expectedTable);
    });
  });
});
