'use strict';

const { getComponents, getLayouts } = require('amphora-fs'),
  makeComponentSQL = require('./003_create_components_tables').generateSql,
  makeLayoutSQL = require('./004_create_layouts_tables').generateSql,
  makeDataStructureSQL = require('./007_create_datastructure_tables').generateSql;

jest.mock('amphora-fs');

describe('/migrations', () => {
  describe('makeComponentSQL', () => {
    test('should return component sql', () => {
      getComponents.mockReturnValue(['article', 'picture', 'title']);
      expect(makeComponentSQL()).toBe(
        'CREATE TABLE IF NOT EXISTS components."article" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); CREATE TABLE IF NOT EXISTS components."picture" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); CREATE TABLE IF NOT EXISTS components."title" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); '
      );
    });
  });

  describe('makeLayoutSQL', () => {
    test('should return layout sql', () => {
      getLayouts.mockReturnValue(['article', 'picture', 'title']);
      expect(makeLayoutSQL()).toBe(
        'CREATE TABLE IF NOT EXISTS layouts."article" ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB ); CREATE TABLE IF NOT EXISTS layouts."picture" ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB ); CREATE TABLE IF NOT EXISTS layouts."title" ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB ); '
      );
    });
  });

  describe('makeDataStructureSQL', () => {
    test('should return data structure sql', () => {
      expect(makeDataStructureSQL()).toBe(
        'CREATE TABLE IF NOT EXISTS "lists" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); CREATE TABLE IF NOT EXISTS "users" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); '
      );
    });
  });

});
