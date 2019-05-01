'use strict';

const { DATA_STRUCTURES } = require('../constants');

function createDataStructuresSQL() {
  return DATA_STRUCTURES.filter(
    struct =>
      struct !== 'components' && struct !== 'pages' && struct !== 'layouts' && struct !== 'uris'
  ).reduce(
    (acc, curr) =>
      acc + `CREATE TABLE IF NOT EXISTS "${curr}" ( id TEXT PRIMARY KEY NOT NULL, data JSONB ); `,
    '' // inital value of acc
  );
}

module.exports.generateSql = createDataStructuresSQL;
