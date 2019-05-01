'use strict';

const { getLayouts } = require('amphora-fs');

function makeLayoutsSQL() {
  const layoutsArr = getLayouts();

  return layoutsArr.reduce(
    (acc, curr) =>
      acc +
      `CREATE TABLE IF NOT EXISTS layouts."${curr}" ( id TEXT PRIMARY KEY NOT NULL, data JSONB, meta JSONB ); `,
    '' // initial value of acc
  );
}

module.exports.generateSql = makeLayoutsSQL;
