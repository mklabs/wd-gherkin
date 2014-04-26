
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
  this.body = [''];
  this.suites = [suite];
  this.lastKeyword = 'Given';
  this.screencount = 0;
  this.options = options || {};
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
    // console.log(ev);
    // console.log('f', keyword);
    // console.log('f', token);
    // console.log('f', line);
    // console.log();
  };
});

// Here, we implement the event we are interrested in

// Feature / Scenario
//
// Gets translated into a Mocha Suite. Equivalent of describe(); for
// ui=bdd.
Parser.prototype.feature =
Parser.prototype.scenario =
function feature(keyword, token, line) {
  if (this.started) this.suites.shift();
  var suite = Suite.create(this.suites[0], token.trim());
  this.suites.unshift(suite);

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
      matches = matches.slice(1).slice(-2);
      fn = function(done) {
        var ctx = this;
        var next = function() {
        self.screencount++;

        // TODO: Figure out generic way
        if (self.options.autorender) ctx.page.render(tmpdir + '/step-screens/step-' + self.screencount + '.png');
        done.apply(this, arguments);
        };

        step.handler.apply(this, matches.concat([next]));
      };
    }
  }

  if (!step) token = token + ' (Pending)';

  var test = new Test(_keyword + ' ' + token, fn);

  test.file = this.file;
  suite.addTest(test);

  this.lastKeyword = _keyword;
  return test;
};

Parser.prototype.add = function add(line) {
  this.body.push(line);
};
