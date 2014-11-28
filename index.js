var Proxy = require('node-proxy');
var type = require('typology').get;
var _ = require('underscore');
var util = require('util');
var Event = require('./eventUtils.js');
var ObjectStore = require('./ObjectStore.js');
var MagicDB = require('./MagicDB.js');


module.exports = function(path) {
  var _this = this;
  magic = MagicDB(path);
  eventProxy = new Event.Proxy(magic.helpers.objectStore.external);
  _this.on = function(evtName, cb) {
    if (!evtName || !cb) {
      console.log((evtName) ? 'No event specified. Ignoring.' : 'No callback supplied to handle event ' + evtName + '. Ignoring.');
      return;
    } else {
      eventProxy.on(evtName, cb);
    }
  }
  _this.emit = function(evtName, data) {
    if (!evtName) {
      console.log('No event specified. Ignoring.');
      return;
    } else {
      eventProxy.emit(evtName, data || undefined);
    }
  }
  _this.db = magic.db;
}

//var MagicDB = require('./');var magicDB = new MagicDB('./base')