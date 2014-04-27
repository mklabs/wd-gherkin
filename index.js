
var path = require('path');

var ghmocha = module.exports;

ghmocha.Parser = require('./lib/parser');
ghmocha.cli = require('./lib/cli');

ghmocha.runner = {};
ghmocha.runner.phantom = path.join(__dirname, 'bin/gherkin-mocha-phantom');
ghmocha.runner.node = path.join(__dirname, 'bin/gherkin-mocha');
