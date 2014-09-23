var fs      = require('fs');
var env     = process.env || require('system').env;
var path    = require('path');
var Gherkin = require('gherkin').Lexer('en');
var debug   = require('debug')('wd-gherkin:cli');

// Exports CLI
var cli = module.exports;

// I/O utility for phantom / node
var phantom = !!fs.workingDirectory;
var cwd = fs.workingDirectory || process.cwd();
function isAbsolute(file) {
  return fs.isAbsolute ? fs.isAbsolute(file) : (path.resolve(file) === file);
}

function ls(filepath) {
  return fs.list ? fs.list(filepath) : fs.readdirSync(filepath);
}

function write(filepath, content) {
  return fs[phantom ? 'write' : 'writeFileSync'](filepath, content);
}

function read(filepath) {
  return phantom ? fs.read(filepath) : fs.readFileSync(filepath, 'utf8');
}

function isFile(file) {
  return phantom ? fs.isFile(file) : fs.statSync(file).isFile();
}

// Stubs for nopt
if (require.stub) {
  require.stub('url', function() {});
  require.stub('stream', function() { return { Stream: function() {} }; });
}

// Parse args

var nopt = cli.nopt = require('nopt')({
  stepdir: String,
  config: String,
  tmpdir: String,
  timeout: Number,
  screendir: String,
  reporter: String,
  grep: String,
  'webdriver-host': String,
  'webdriver-port': Number,
  'webdriver-username': String,
  'webdriver-accesskey': String,
  'webdriver-browser': String
});

var tmpdir = nopt.tmpdir || './tmp';
var tmpfiles = [];

var files = nopt.argv.remain;
var config = cli.config = {};

if (nopt.config) {
  config = require(isAbsolute(nopt.config) ? nopt.config : path.join(cwd, nopt.config));
} else if (env.JSON_CONFIG) {
  try {
    config = JSON.parse(env.JSON_CONFIG);
  } catch(e) {}
}

// Require & init mocha
var Mocha = require('mocha');
var mocha = new Mocha();

mocha.reporter(nopt.reporter || 'spec');

var timeout = nopt.timeout || config.timeout || 60000;
timeout = parseInt(timeout, 10);
mocha.timeout(isNaN(timeout) ? 60000 : timeout);

if (nopt.grep) mocha.grep(new RegExp(nopt.grep));

var Suite = Mocha.Suite;
var Test = Mocha.Test;
var utils = Mocha.utils;

// Parser
var Parser = require('../lib/parser');

// Main routine
cli.run = function run(done) {
  done = done || function() {};

  debug('Running');

  // Steps matching
  //
  // Expose nopt parsed args as global variable for easy access from steps.
  global.nopt = nopt;

  debug('Opts', nopt);

  // Load and register
  var steps = require('../lib/steps');

  // Handle stepdir, loading every .js file under this dir
  var stepfiles = [];
  if (nopt.stepdir) {
    debug('Loading steps from', nopt.stepdir);
    stepfiles = ls(nopt.stepdir).filter(function(file) {
      if (file === '.') return false;
      if (file === '..') return false;
      if (path.extname(file) !== '.js') return false;
      return isFile(path.join(nopt.stepdir, file));
    }).map(function(file) {
      return path.join(nopt.stepdir, file);
    });
  }

  // Handle test from config.json, writes temporary files
  if (config.steps) {
    debug('Loading %d steps from config', config.steps.length);
    config.steps.forEach(function(step) {
      var filename = path.join(tmpdir, step.name);
      write(filename, (step.body || '') + '\n');
    });

    stepfiles = config.steps.map(function(step) {
      return path.join(tmpdir, step.name);
    });

    stepfiles.forEach(function(step) {
      tmpfiles.push(step);
    });
  }

  // Handle features from config.json, writes temporary files
  if (config.features) {
    debug('Loading %d features from config', config.features.length);
    config.features.forEach(function(feature) {
      var filename = path.join(tmpdir, feature.name);
      write(filename, (feature.body || '') + '\n');
    });

    files = config.features.map(function(feature) {
      return path.join(tmpdir, feature.name);
    });

    files.forEach(function(step) {
      tmpfiles.push(step);
    });
  }

  stepfiles.forEach(function(file) {
    file = isAbsolute(file) ? file : path.join(cwd, file);
    require(file);
  });

  // Process, scan files, translate into mocha suites
  files = files.map(function(file) {
    debug('Run %s file', file);
    var filename = file;
    var body = read(file);

    var parser = new Parser(mocha.suite, file, steps, nopt);
    var lexer = new Gherkin(parser);
    lexer.scan(body);

    return {
      filename: filename,
      body: body,
      parser: parser
    };
  });

  return mocha.run(done);
};
