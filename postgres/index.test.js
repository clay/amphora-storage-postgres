'use strict';

const { setup } = require('./index'),
  client = require('./client'),
  { getComponents, getLayouts } = require('amphora-fs'),
  { migrate } = require('postgres-migrations');

jest.mock('./client');
jest.mock('amphora-fs');
jest.mock('postgres-migrations');

describe('postgres/index', () => {
  test('calls connect and then sets up the db', () => {
    client.connect.mockResolvedValue('');
    getComponents.mockReturnValue(['foo', 'bar', 'baz']);
    getLayouts.mockReturnValue(['baz', 'bar',  'foo']);
    migrate.mockResolvedValue('');

    return setup('localhost').then(resp => {
      expect(client.connect.mock.calls.length).toBe(1);
      expect(resp).toHaveProperty('server');
    });
  });

  test('throws if there is no postgres host set', () => {
    return setup()
      .catch(err => {
        expect(err).toHaveProperty('message', 'No postgres host set');
      });
  });
});
