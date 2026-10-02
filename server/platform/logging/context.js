const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();
function currentTrace() { return storage.getStore(); }
function withTrace(trace, task) { return storage.run(trace, task); }

module.exports = { currentTrace, withTrace };
