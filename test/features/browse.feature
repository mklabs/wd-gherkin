Feature: Node Runner

  Willing to quickly assert nodejs / phantom runner

  Scenario: Searching gherkin
    Given I browse URL "http://google.com"
    Then I fill "gherkin" in "q"
    And I submit the form "[action='/search']"
    And I want to render the page at "debug.png"

  Scenario: Browsing http://phantomjs.org/
    Given I brawl URL "http://phantomjs.org/"


  Scenario: Browsing example.com/n
    Given I browse URL "https://github.com/cucumber/cucumber/wiki/Gherkin"

