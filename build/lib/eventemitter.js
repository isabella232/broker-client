var EventEmitter,
  __slice = [].slice;

module.exports = EventEmitter = (function() {
  var _off, _on, _registerEvent, _unregisterEvent;

  EventEmitter.registerStaticEmitter = function() {
    return this._e = {};
  };

  _registerEvent = function(registry, eventName, listener) {
    if (registry[eventName] == null) {
      registry[eventName] = [];
    }
    return registry[eventName].push(listener);
  };

  _unregisterEvent = function(registry, eventName, listener) {
    var cbIndex;
    if (!eventName || eventName === "*") {
      return registry = {};
    } else if (listener && registry[eventName]) {
      cbIndex = registry[eventName].indexOf(listener);
      if (cbIndex >= 0) {
        return registry[eventName].splice(cbIndex, 1);
      }
    } else {
      return registry[eventName] = [];
    }
  };

  _on = function(registry, eventName, listener) {
    var name, _i, _len, _results;
    if (eventName == null) {
      throw new Error('Try passing an event, genius!');
    }
    if (listener == null) {
      throw new Error('Try passing a listener, genius!');
    }
    if (Array.isArray(eventName)) {
      _results = [];
      for (_i = 0, _len = eventName.length; _i < _len; _i++) {
        name = eventName[_i];
        _results.push(_registerEvent(registry, name, listener));
      }
      return _results;
    } else {
      return _registerEvent(registry, eventName, listener);
    }
  };

  _off = function(registry, eventName, listener) {
    var name, _i, _len, _results;
    if (Array.isArray(eventName)) {
      _results = [];
      for (_i = 0, _len = eventName.length; _i < _len; _i++) {
        name = eventName[_i];
        _results.push(_unregisterEvent(registry, name, listener));
      }
      return _results;
    } else {
      return _unregisterEvent(registry, eventName, listener);
    }
  };

  EventEmitter.emit = function() {
    var args, eventName, listener, listeners, _base, _i, _len;
    if (this._e == null) {
      throw new Error('Static events are not enabled for this constructor.');
    }
    eventName = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    listeners = (_base = this._e)[eventName] != null ? _base[eventName] : _base[eventName] = [];
    for (_i = 0, _len = listeners.length; _i < _len; _i++) {
      listener = listeners[_i];
      listener.apply(null, args);
    }
    return this;
  };

  EventEmitter.on = function(eventName, listener) {
    if ('function' !== typeof listener) {
      throw new Error('listener is not a function');
    }
    if (this._e == null) {
      throw new Error('Static events are not enabled for this constructor.');
    }
    this.emit('newListener', listener);
    _on(this._e, eventName, listener);
    return this;
  };

  EventEmitter.off = function(eventName, listener) {
    this.emit('listenerRemoved', eventName, listener);
    _off(this._e, eventName, listener);
    return this;
  };

  function EventEmitter(options) {
    var maxListeners;
    if (options == null) {
      options = {};
    }
    maxListeners = options.maxListeners;
    this._e = {};
    this._maxListeners = maxListeners > 0 ? maxListeners : 10;
  }

  EventEmitter.prototype.emit = function() {
    var args, eventName, listenerStack, _base;
    eventName = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if ((_base = this._e)[eventName] == null) {
      _base[eventName] = [];
    }
    listenerStack = [];
    listenerStack = listenerStack.concat(this._e[eventName].slice(0));
    listenerStack.forEach((function(_this) {
      return function(listener) {
        return listener.apply(_this, args);
      };
    })(this));
    return this;
  };

  EventEmitter.prototype.on = function(eventName, listener) {
    if ('function' !== typeof listener) {
      throw new Error('listener is not a function');
    }
    this.emit('newListener', eventName, listener);
    _on(this._e, eventName, listener);
    return this;
  };

  EventEmitter.prototype.off = function(eventName, listener) {
    this.emit('listenerRemoved', eventName, listener);
    _off(this._e, eventName, listener);
    return this;
  };

  EventEmitter.prototype.once = function(eventName, listener) {
    var _listener;
    _listener = (function(_this) {
      return function() {
        var args;
        args = [].slice.call(arguments);
        _this.off(eventName, _listener);
        return listener.apply(_this, args);
      };
    })(this);
    this.on(eventName, _listener);
    return this;
  };

  return EventEmitter;

})();
