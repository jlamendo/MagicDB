var metaDB;
var Level = require('level');
var LevelUp = require('levelup');
var SubLevel = require('level-sublevel');
var deasync = require('deasync');
var Event = require('./eventUtils.js');
var async = require('async');

var ObjectStore = function(namespace) {
  this.internal = new Event.Emitter();
  this.external = new Event.Emitter();
  var _this = this;
  if (typeof namespace !== 'string') {
    throw new Error('Unable to allocate database using namespace ' + namespace + '.');
  }
  _this.namespace = namespace;
  if (metaDB === undefined) {
    metaDB = this.db = new SubLevel(Level(__dirname + '/' + _this.namespace));
    _this.__isMaster = true;
  } else {
    this.db = metaDB.sublevel(_this.namespace);
  };

  this.putSync = deasync(_this.db.put);
  this.getSync = deasync(_this.db.get);
  this.deleteSync = deasync(this.db.del);
  // create a queue object with concurrency 2
  _this.locked = {};
  _this.lock = function(key) {
    if (_this.locked[key] === true) {
      return false;
    } else {
      _this.locked[key] = true;
      return true;
    }
  }

  _this.unlock = function(key) {
    if (_this.locked[key] && _this.locked[key] === true) {
      delete _this.locked[key];
      return true;
    } else {
      return false;
    }
  }
  _this.statsInterval = 0;
  _this.listeners = {};


  _this.stack = {
    _put: async.queue(function(kv, callback) {
      if (_this.lock(kv.key)) {
          kv.value = JSON.stringify(kv.value);
        _this.db.put(kv.key, kv.value, function(err, res) {
          if (err) {
            _this.external.emit('Error', {
              msg: 'Attempt to put ' + key + ' into storage failed.',
              error: err
            });
          }
          _this.internal.emit('put', kv);
          callback(kv.key);
        });
      }
    }, 50),

    _del: async.queue(function(kv, callback) {
      if (_this.lock(kv.key)) {
        _this.db.del(kv.key, function(err, res) {
          if (err) {
            _this.external.emit('Error', {
              msg: 'Attempt to delete ' + kv.key + ' from storage failed.',
              error: err
            });
          }
          _this.internal.emit('del', kv.key);
          callback(kv.key);
        });
      }
    }, 15),
    put: function(key, value) {
      _this.stack._put.push({
        key: key,
        value: value
      }, _this.unlock);
    },
    del: function(key) {
      _this.stack._del.push({
        key: key
      }, _this.unlock);
    }
  }

  _this.external.on('config', function(config) {
    Object.keys(config).forEach(function(option) {
      _this[option] = config[option];
    });
    if (_this.statsInterval > 0) {
      _this.stack.put.drain = function() {
        _this.external.emit('status', {
          type: 'put.drain',
          val: 'true'
        });
      };
      _this.stack.del.drain = function() {
        _this.external.emit('status', {
          type: 'del.drain',
          val: 'true'
        });
      };
      _this.statUpdate = function() {
        setTimeout(function() {
          _this.external.emit('status', {
            type: 'del.active',
            val: _this.stack.del.running()
          });
          _this.external.emit('status', {
            type: 'del.waiting',
            val: _this.stack.del.length()
          });
          _this.external.emit('status', {
            type: 'put.active',
            val: _this.stack.put.running()
          });
          _this.external.emit('status', {
            type: 'put.waiting',
            val: _this.stack.put.length()
          });
          if (_this.statsInverval > 0) {
            return _this.statUpdate();
          }
        }, _this.statsInterval);
      }
    }
  });

  _this.external.on('sync', function(action) {
    switch (action) {
      case 'pause':
        break;
      case 'resume':
        break;
      default:
        return;
        break;
    }
    _this.stack.put[action]();
    _this.stack.del[action]();
  });
  _this.put = _this.stack.put;
  _this.get = function(key) {
    try {
      return JSON.parse(_this.getSync(key));
    } catch (err) {
      _this.external.emit('Error', {
        msg: 'Attempt to get ' + key + ' from storage failed.',
        error: err
      });
    }
  }
  _this.del = _this.stack.del;
}
module.exports = ObjectStore;