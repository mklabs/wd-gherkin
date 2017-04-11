
# Gherkin Mocha

Combining both [Gherkin](https://github.com/cucumber/cucumber/wiki/Gherkin)
and [Mocha](http://mochajs.org/), as a phantomjs or node runner.

## Description

This module implements a basic parser on top of
[cucumber/gherkin](https://github.com/cucumber/gherkin) JS
  implementation, to match Gherkin keywords and structure into Mocha
`Suite` and `Test`.

It can be seen as some sort of special Mocha UI, using both `.feature`
files to express the specs, and steps files to define how the tests are
implemented.

Borrows a lot to Cucumber, without being a strict and valid Cucumber
implementation.

> TODO: Background, table and examples.

## Examples

### PhantomJS

Using phantomjs environment, steps written using PhantomJS API.

```bash
# For phantomjs
phantomjs bin/gherkin-mocha-phantom --stepdir test/phantom-steps test/features/browse.feature
```

### Using PhantomJS in Webdriver mode

Using nodejs environment, steps written in node using Webdriver API.

```bash
phantomjs --webdriver=9134

# in another shell
./bin/gherkin-mocha --stepdir test/node-steps test/features/browse.feature
```

## Features

A basic example.

```feature
Feature: Node Runner

  Willing to quickly assert nodejs / phantom runner

  Scenario: Searching gherkin
    Given I browse URL "http://google.com"
    Then I fill "gherkin" in "q"
    And I submit the form "[action='/search']"
    And I want to render the page at "debug.png"
```

Please note that only Feature, Scenarios, Given, When, Then and the And
keywords are supported, and only basic support.

Further work is needed to bridge stuff like Background, Example tables,
Step tables etc. to Mocha land.

## Steps

Steps are written in node or phantom, using three global function
helpers: Given, When, Then.

They're just semantic sugar, they're handled exactly the same by the
framework.

The `--stepdir` option is used to tell the system where to load them
(not recursively, but you can require from there)

```js
// Node
Given(/I browse URL "([^"]+)"/, function(url, done) {
  var wd = require('wd');

  if (!this.driver) this.driver = wd.remote(webdriverHost, webdriver);

  var driver = this.driver;
  driver.init(function(err) {
    if (err) return done(err);
    // driver#get should errback on invalid URL
    driver.get(url, done);
  });
});

// Phantom
Given(/I browse URL "([^"]+)"/, function(url, done) {
  var page = this.page = require('webpage').create();
  page.open(url, function(status) {
    if (status !== 'success') return done(new Error('Error opening URL ' + url + '. Status: ' + status));
    done();
  });
});
```
