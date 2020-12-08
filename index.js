'use strict';

const db = require('./services/db');

module.exports.setup = require('./services/setup');
module.exports.put = db.put;
module.exports.get = db.get;
module.exports.del = db.del;
module.exports.batch = db.batch;
module.exports.putMeta = db.putMeta;
module.exports.patchMeta = db.patchMeta;
module.exports.getMeta = db.getMeta;
module.exports.raw = db.raw;
module.exports.createReadStream = db.createReadStream;
