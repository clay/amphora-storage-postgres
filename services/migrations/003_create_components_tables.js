'use strict';

const { getComponents } = require('amphora-fs');

function makeComponentsSQL() {
  const componentsArr = getComponents();

  return componentsArr.reduce(
    (acc, curr) =>
      acc +
      `CREATE TABLE IF NOT EXISTS components."${curr}" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); `,
    '' // initial value of acc
  );
}

module.exports.generateSql = makeComponentsSQL;
