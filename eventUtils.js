var util = require('util');
var EventEmitter = require('events').EventEmitter;
function eventProxy(dest) {
  if (!dest instanceof EventEmitter) {
    return;
  }
  EventEmitter.call(this);
  this._on = this.on;
  this._emit = this.emit;
  this.on = function(evt, cb) {
    dest.on(evt, cb);
  }
  this.emit = function(evt, data) {
    dest.emit(evt, data);
  };
}

util.inherits(eventProxy, EventEmitter);

function eventEmitter() {
  EventEmitter.call(this);
}

util.inherits(eventEmitter, EventEmitter);

module.exports = {
  Emitter: eventEmitter,
  Proxy: eventProxy,
}