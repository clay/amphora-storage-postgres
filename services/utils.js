'use strict';

const { DATA_STRUCTURES } = require('./constants'),
  { getComponentName, getLayoutName } = require('clayutils'),
  { isList } = require('clayutils');

/**
 * Try to parse the stringified object.
 * Return the value if it does not parse.
 *
 * @param  {Object|String} value
 * @return {Object|String}
 */
function parseOrNot(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function findSchemaAndTable(key) {
  var table, schema;

  for (let i = 0; i < DATA_STRUCTURES.length; i++) {
    let DATA_TYPE = DATA_STRUCTURES[i];

    if (key.indexOf(`/_${DATA_TYPE}`) > -1) {
      if (DATA_TYPE === 'components' || DATA_TYPE === 'layouts') {
        schema = DATA_TYPE;
        table = getComponentName(key) || getLayoutName(key);
      } else {
        table = DATA_TYPE;
      }

      // Exit fast if we get the match
      break;
    }
  }

  return { schema, table };
}

module.exports.findSchemaAndTable = findSchemaAndTable;
module.exports.parseOrNot = parseOrNot;
