var EventEmitter,
  slice = [].slice;

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
    var i, len, name, results;
    if (eventName == null) {
      throw new Error('Try passing an event, genius!');
    }
    if (listener == null) {
      throw new Error('Try passing a listener, genius!');
    }
    if (Array.isArray(eventName)) {
      results = [];
      for (i = 0, len = eventName.length; i < len; i++) {
        name = eventName[i];
        results.push(_registerEvent(registry, name, listener));
      }
      return results;
    } else {
      return _registerEvent(registry, eventName, listener);
    }
  };

  _off = function(registry, eventName, listener) {
    var i, len, name, results;
    if (Array.isArray(eventName)) {
      results = [];
      for (i = 0, len = eventName.length; i < len; i++) {
        name = eventName[i];
        results.push(_unregisterEvent(registry, name, listener));
      }
      return results;
    } else {
      return _unregisterEvent(registry, eventName, listener);
    }
  };

  EventEmitter.emit = function() {
    var args, base, eventName, i, len, listener, listeners;
    if (this._e == null) {
      throw new Error('Static events are not enabled for this constructor.');
    }
    eventName = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    listeners = (base = this._e)[eventName] != null ? base[eventName] : base[eventName] = [];
    for (i = 0, len = listeners.length; i < len; i++) {
      listener = listeners[i];
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
    var args, base, eventName, listenerStack;
    eventName = arguments[0], args = 2 <= arguments.length ? slice.call(arguments, 1) : [];
    if ((base = this._e)[eventName] == null) {
      base[eventName] = [];
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
