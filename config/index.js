"use strict";

var nconf = require("nconf");
var path = require('path');

nconf.argv().file({ file: path.join(__dirname, "config.json") });

module.exports = nconf;