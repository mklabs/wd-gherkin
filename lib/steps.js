
var steps = module.exports = [];

global.Given = function Given(reg, handler) {
  reg = typeof reg === 'string' ? new RegExp('^' + reg + '$') : reg;
  steps.push({
    keyword: 'Given',
    reg: reg,
    handler: handler
  });
};

global.When = function When(reg, handler) {
  reg = typeof reg === 'string' ? new RegExp('^' + reg + '$') : reg;
  steps.push({
    keyword: 'When',
    reg: reg,
    handler: handler
  });
};

global.Then = function Then(reg, handler) {
  reg = typeof reg === 'string' ? new RegExp('^' + reg + '$') : reg;
  steps.push({
    keyword: 'Then',
    reg: reg,
    handler: handler
  });
};
