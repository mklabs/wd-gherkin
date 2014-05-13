
var wd    = require('wd');
var path  = require('path');

var tty = require('tty');
// go tonton
var tatty = tty.isatty;
// force debug in tty mode
tty.isatty = function() { return true; };
var debug = require('debug')('wd-gherkin:parser');
tty.isatty = tatty;

// Require & init mocha
var Mocha = require('mocha');
var Suite = Mocha.Suite;
var Test  = Mocha.Test;
var utils = Mocha.utils;

// Parser
//
// Part responsible of handling each step and keyword Gherkin parser
// encounters, to translate them into Mocha Suite and Test case.
//
// It can be seen as some sort of special Mocha UI, using both .feature
// file to express the spec, and steps files to define how the test is
// implemented.
//
// Borrows a lot to Cucumber, without being a strict and valid Cucumber
// implementation.
//
// TODO: Background, table and examples.

function Parser(suite, file, steps, options) {
  this.steps = steps || [];
  this.file = file;

  this.suite = suite;
  this._feature = this.suite;

  this.body = [''];
  this.suites = [suite];
  this.lastKeyword = 'Given';
  this.screencount = 0;
  this.options = options || {};

  this.options.webdriver = !!this.options['webdriver-host'];
  this.options['webdriver-host'] = this.options['webdriver-host'] || 'localhost';
  this.options['webdriver-port'] = this.options['webdriver-port'] || 9134;
  this.options['webdriver-username'] = this.options['webdriver-username'] || '';
  this.options['webdriver-accesskey'] = this.options['webdriver-accesskey'] || '';
  this.options['webdriver-browser'] = this.options['webdriver-browser'] || 'phantomjs';

}

module.exports = Parser;

var events = [
  'comment',
  'tag',
  'feature',
  'background',
  'scenario',
  'scenario_outline',
  'examples',
  'step',
  'doc_string',
  'row',
  'eof'
];

// This is to prevent Gerkin from throwing, it requires each and every
// event to be listened to, and handled.
events.forEach(function(ev) {
  Parser.prototype[ev] = function(keyword, token, line) {
    // debug('Parse', ev, keyword, token, line);
  };
});

// Here, we implement the event we are interrested in

// Feature / Scenario
//
// Gets translated into a Mocha Suite. Equivalent of describe(); for
// ui=bdd.
Parser.prototype.feature = function feature(keyword, token, line) {
  // debug('Feature', keyword, token, line);
  if (this.started) this.suites.shift();

  var suite = Suite.create(this.suites[0], token.trim());
  this.suites.unshift(suite);


  this.started = true;
  return suite;

};

Parser.prototype.scenario = function scenario(keyword, token, line) {
  if (this.started) this.suites.shift();

  var suite = Suite.create(this.suites[0], token.trim());
  this.suites.unshift(suite);

  if (this.options.webdriver) this.createWebdriver(suite, line);

  this.started = true;
  return suite;
};

// Step
//
// A step becomes a Test case in Mocha land. Equivalent of it();
//
// This is where we try to match a `token` to a registered step if any.
//
// Steps unknown are registered as Pending test to Mocha.
//
// Steps arguments, a regexp match expresion, are partially applied to
// the test case handler, and the last argument is always the `done`
// Mocha async callback.
//
// Example:
//
//  Given I browse URL "http://example.com"
//
// This step defines one argument capture, the according step would be:
//
//  Given(/I browse URL "([^"]+)"/, function(url, done) {
//    // code ...
//
//    // When done, invoke the done callback to let Mocha knows we're
//    // good to go.
//    done();
//  });
//
Parser.prototype.step = function _step(keyword, token, line) {
  // debug('Feature', keyword, token, line);
  var suites = this.suites;
  var suite = suites[0];
  var self = this;
  keyword = keyword.trim();

  var _keyword = keyword === 'And' ? this.lastKeyword : keyword;

  var step = this.steps.filter(function(step) {
    if (_keyword !== step.keyword) return;
    if (!step.reg.test(token)) return;
    return true;
  })[0];

  var fn = step ? step.handler : null;

  var matches = [];
  if (step) {
    matches = token.match(step.reg);
    if (matches) {
      matches = matches.slice(1);
      fn = this.stepFn(matches, step);
    }
  }

  if (!(step && step.handler)) token = token + ' (Pending)';
  return this.createTest(suite, _keyword, token, fn);
};

Parser.prototype.stepFn = function stepFn(matches, step) {
  var self = this;

  if (!step) throw new Error('Missing step');

  return function _step(done) {

    var ctx = this;
    function next () {
      self.screencount++;
      var args = [].slice.call(arguments);
      if (!self.options.screendir) return done.apply(ctx, args);

      // TODO: Figure out generic way
      var screenfile = path.join(self.options.screendir, 'step-' + self.screencount + '.png');
      if (ctx.page) {
        // Phantom
        ctx.page.render(screenfile);
        done.apply(ctx, args);
      } else if (ctx.driver || ctx.browser) {
        // Webdriver
        (ctx.driver || ctx.browser).saveScreenshot(screenfile, function(err) {
          if (err) return done(err);
          done.apply(ctx, args);
        });
      }
    }

    step.handler.apply(this, matches.concat([next]));
  };
};

Parser.prototype.createTest = function createTest(suite, keyword, title, fn) {
  // debug('Creating test', keyword, title);
  var test = new Test(keyword + ' ' + title, fn);
  test.file = this.file;
  suite.addTest(test);

  this.lastKeyword = keyword;
  return test;
};

Parser.prototype.createWebdriver = function createWebdriver(suite, line) {
  var options = this.options;
  var allPassed = true;
  var self = this;

  debug('Creating webdriver listeners');

  suite.beforeAll(function(done) {
    debug('Before');
    if (this.driver) return done();

    debug('Before all. Creating webdriver');

    // Init webdriver browser for the current suite, store as
    wd.configureHttp( {
      timeout: 60000,
      retryDelay: 15000,
      retries: 5
    });

    debug('Init webdriver remote %s:%d', options['webdriver-host'], options['webdriver-port']);

    this.driver = wd.remote({
      hostname: options['webdriver-host'],
      port: options['webdriver-port'],
      user: options['webdriver-username'],
      pwd: options['webdriver-accesskey']
    }, options.driverType || 'promiseChain');

    var desired = {};
    desired.browserName = options['webdriver-browser'];
    desired.name = suite.title;
    desired.tags = [options['webdriver-browser'], 'feature'];

    debug('Desired browser', desired.browserName);
    this.driver.init(desired, done);
  });

  suite.afterEach(function(done) {
    debug('After each');

    allPassed = allPassed && (this.currentTest.state === 'passed');
    done();
  });

  suite.afterAll(function(done) {
    debug('After');

    var ctx = this;
    this.driver.quit(function(err) {
      if (err) return done(err);

      debug('Quit browser');

      if (options['webdriver-accesskey']) {
        debug('Submitting sauce status. All passed: %s', allPassed);
        ctx.diver.sauceJobStatus(allPassed, done);
      } else {
        done();
      }

      ctx.driver = null;
    });
  });

  this.body.push(line);
};
