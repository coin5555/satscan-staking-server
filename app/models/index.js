const dbConfig = require("../config/db.config.js");

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;
db.stakes = require("./stake.model.js")(mongoose);
db.unstakes = require("./unstake.model.js")(mongoose);
db.totals = require("./total.model.js")(mongoose);


module.exports = db;
