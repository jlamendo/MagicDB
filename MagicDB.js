var ObjectStore = require('./ObjectStore.js');
var Proxy = require('node-proxy');

function getProxyHandle(obj, path, objPath) {
  if (objPath) {
    path = objPath + '.' + path;
  }
  var objectStore = new ObjectStore(path);
  var clone = function(srcObj) {
    if (srcObj instanceof Object) {
      for (var attr in srcObj) {
        if (srcObj.hasOwnProperty(attr)) {
          objectStore.put(attr, obj[attr] || clone(obj[attr]));
        }
      }
    } else return srcObj;
  }

  var eventLog = function() {
    var args = Array.prototype.slice.call(arguments);
    objectStore.external.emit('log', _.extend({}, args));
  }
  return {
    handlers: {
      // fundamental traps
      getOwnPropertyDescriptor: function(name) {
        try {
          var desc = Object.getOwnPropertyDescriptor(obj, name);
          eventLog({
            op: 'getOwnPropertyDescriptor',
            args: [name],
            res: desc
          });
          return desc;
        } catch (err) {
          eventLog({
            op: 'getOwnPropertyDescriptor',
            args: [name],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      getPropertyDescriptor: function(name) { // ES-harmony addition
        try {
          var desc = Object.getPropertyDescriptor(obj, name); // assumed
          // a trapping proxy's properties must always be configurable
          // desc.configurable = true;
          eventLog({
            op: 'getPropertyDescriptor',
            args: [name],
            res: desc
          });
          return desc;
        } catch (err) {
          eventLog({
            op: 'getPropertyDescriptor',
            args: [name],
            exc: err
          });
          return eventLog({
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      getOwnPropertyNames: function() {
        try {
          var names = Object.getOwnPropertyNames(obj);
          eventLog({
            op: 'getOwnPropertyNames',
            args: [],
            res: names
          });
          return names;
        } catch (err) {
          eventLog({
            op: 'getOwnPropertyNames',
            args: [],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      getPropertyNames: function() { // ES-harmony addition
        try {
          var names = Object.getPropertyNames(obj);
          eventLog({
            op: 'getPropertyNames',
            args: [],
            res: names
          });
          return names;
        } catch (err) {
          eventLog({
            op: 'getPropertyNames',
            args: [],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      defineProperty: function(name, desc) {
        try {
          var val = Object.defineProperty(obj, name, desc);
          eventLog({
            op: 'defineProperty',
            args: [name, desc],
            res: val
          });
          return val;
        } catch (err) {
          eventLog({
            op: 'defineProperty',
            args: [name, desc],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      'delete': function(name) {
        try {
          var bool = delete obj[name];
          return bool;
        } catch (err) {
          print(uneval(err));
          eventLog({
            op: 'delete',
            args: [name],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      fix: function() {
        try {
          var props = {};
          for (x in obj) {
            props[x] = Object.getOwnPropertyDescriptor(obj, x);
          }
          Object.freeze(obj);
          eventLog({
            op: 'fix',
            args: [],
            res: props
          });
          return props;
        } catch (err) {
          eventLog({
            op: 'fix',
            args: [],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },

      // derived traps

      has: function(name) {
        try {
          var bool = name in obj;
          eventLog({
            op: 'has',
            args: [name],
            res: bool
          });
          return bool;
        } catch (err) {
          eventLog({
            op: 'has',
            args: [name],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      hasOwn: function(name) {
        try {
          var bool = ({}).hasOwnProperty.call(obj, name);
          eventLog({
            op: 'hasOwn',
            args: [name],
            res: bool
          });
          return bool;
        } catch (err) {
          eventLog({
            op: 'hasOwn',
            args: [name],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      get: function(receiver, name) {
        if (name === undefined) {
          return obj;
        } else if (name === '__mdbOn') {
          return function() {
            var args = Array.prototype.slice.call(arguments);
            objectStore.internal.on(name + '::' + args.unshift(), (function() {
              var tmp = console.log;
              args.forEach(function(arg) {
                if (typeof arg === 'function') {
                  tmp = arg;
                }
              });
              return tmp;
            })());
          }
        } else if (name === '__mdbEmit') {
          return function() {
            var args = Array.prototype.slice.call(arguments);
            return objectStore.internal.emit(name + '::' + args.unshift(), _.extend({}, args));
          }
        } else if (name === '__mdbNamespace') {
          return objectStore.namespace;
        }
        var namespace;
        if (typeof receiver === 'object' && receiver['__mdbNamespace'] !== undefined) {
          namespace = receiver['__mdbNamespace'];
        } else {
          namespace = objectStore.namespace;
        };
        if (name === '__child') {
          return function(name) {
            if (!obj[name] || !obj[name]['__mdbNamespace']) {
              obj[name] = createDB(new Object(), name, namespace).db;
            };
            return obj[name];
          }
        }
        try {
          if (obj[name] === undefined) {
            obj[name] = objectStore.get(namespace + '.' + name);
          }
          return obj[name] || undefined;
        } catch (err) {
          objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
          return undefined;
        }
      },
      set: function(receiver, name, val) {
        if (name === undefined) {
          return;
        }
        var namespace;
        if (typeof receiver === 'object' && receiver['__mdbNamespace'] !== undefined) {
          namespace = receiver['__mdbNamespace'];
        } else {
          namespace = objectStore.namespace;
        }
        if (val === undefined) {
          delete obj[name];
          objectStore.del(namespace + '.' + name);
          return;
        }
        try {
          obj[name] = val;
          objectStore.put(namespace + '.' + name, val);
        } catch (err) {
          return eventLog({
            op: 'set',
            args: [obj, name, val],
            exc: err
          });
        }
      },
      enumerate: function() {
        try {
          var result = [];
          for (name in obj) {
            result.push(name);
          };
          eventLog({
            op: 'enumerate',
            args: [],
            res: result
          });
          return result;
        } catch (err) {
          eventLog({
            op: 'enumerate',
            args: [],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      keys: function() {
        try {
          var ks = Object.keys(obj);
          eventLog({
            op: 'keys',
            args: [],
            res: ks
          });
          return ks;
        } catch (err) {
          eventLog({
            op: 'keys',
            args: [],
            exc: err
          });
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      }
    },
    helpers: {
      objectStore: objectStore
    }
  }
};

function MagicDB(obj, path, namespace) {
  var isChild = false;
  if (typeof obj === 'string') {
    if (path && typeof path === 'string') {
      path = obj + '.' + path;
    } else {
      path = obj;
    }
    obj = new Object();

  } else {
    isChild = true;
    if (namespace) {
      path = namespace + '.' + path;
    }
  }

  if (!obj) {
    obj = new Object();
  };
  var proxyHandle = getProxyHandle(obj, path, isChild);
  return {
    db: Proxy.createFunction(proxyHandle.handlers,
      //call
      function() {
        var args = Array.prototype.slice.call(arguments);
        console.log('call:')
        console.log(args);
        try {
          var val = obj.apply(this, args);
          return val;
        } catch (err) {
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      },
      //construct
      function() {
        var args = Array.prototype.slice.call(arguments);
        console.log('construct:')
        console.log(args);
        try {
          var val = obj.apply(Object.create(obj.prototype), args);
          return val;
        } catch (err) {
          return objectStore.external.emit('Error', {
            msg: 'unknown error.\n Arguments: ' + arguments,
            error: err
          });
        }
      }
    ),
    helpers: proxyHandle.helpers
  }
}

var createDB = function (obj, path, namespace) {
  return new MagicDB(obj, path, namespace);
}
module.exports = createDB;

