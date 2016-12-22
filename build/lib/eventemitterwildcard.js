var EventEmitter, EventEmitterWildcard,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __slice = [].slice;

EventEmitter = require('./eventemitter');

module.exports = EventEmitterWildcard = (function(_super) {
  var getAllListeners, listenerKey, removeAllListeners, wildcardKey;

  __extends(EventEmitterWildcard, _super);

  wildcardKey = '*';

  listenerKey = '_listeners';

  function EventEmitterWildcard(options) {
    if (options == null) {
      options = {};
    }
    EventEmitterWildcard.__super__.constructor.apply(this, arguments);
    this._delim = options.delimiter || '.';
  }

  EventEmitterWildcard.prototype.setMaxListeners = function(n) {
    return this._maxListeners = n;
  };

  getAllListeners = function(node, edges, i) {
    var listeners, nextNode, straight, wild;
    if (i == null) {
      i = 0;
    }
    listeners = [];
    if (i === edges.length) {
      straight = node[listenerKey];
    }
    wild = node[wildcardKey];
    nextNode = node[edges[i]];
    if (straight != null) {
      listeners = listeners.concat(straight);
    }
    if (wild != null) {
      listeners = listeners.concat(getAllListeners(wild, edges, i + 1));
    }
    if (nextNode != null) {
      listeners = listeners.concat(getAllListeners(nextNode, edges, i + 1));
    }
    return listeners;
  };

  removeAllListeners = function(node, edges, it, i) {
    var edge, listener, listeners, nextNode;
    if (i == null) {
      i = 0;
    }
    edge = edges[i];
    nextNode = node[edge];
    if (nextNode != null) {
      return removeAllListeners(nextNode, edges, it, i + 1);
    }
    if ((it != null) && ((listeners = node[listenerKey]) != null)) {
      node[listenerKey] = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = listeners.length; _i < _len; _i++) {
          listener = listeners[_i];
          if (listener !== it) {
            _results.push(listener);
          }
        }
        return _results;
      })();
    } else {
      node[listenerKey] = [];
    }
  };

  EventEmitterWildcard.prototype.emit = function() {
    var eventName, listener, listeners, oldEvent, rest, _i, _len;
    eventName = arguments[0], rest = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    "use strict";
    if (this.hasOwnProperty('event')) {
      oldEvent = this.event;
    }
    this.event = eventName;
    listeners = getAllListeners(this._e, eventName.split(this._delim));
    for (_i = 0, _len = listeners.length; _i < _len; _i++) {
      listener = listeners[_i];
      listener.apply(this, rest);
    }
    if (oldEvent != null) {
      this.event = oldEvent;
    } else {
      delete this.event;
    }
    return this;
  };

  EventEmitterWildcard.prototype.off = function(eventName, listener) {
    removeAllListeners(this._e, (eventName != null ? eventName : '*').split(this._delim), listener);
    return this;
  };

  EventEmitterWildcard.prototype.on = function(eventName, listener) {
    var edge, edges, listeners, node, _i, _len;
    if ('function' !== typeof listener) {
      throw new Error('listener is not a function');
    }
    this.emit('newListener', eventName, listener);
    edges = eventName.split(this._delim);
    node = this._e;
    for (_i = 0, _len = edges.length; _i < _len; _i++) {
      edge = edges[_i];
      node = node[edge] != null ? node[edge] : node[edge] = {};
    }
    listeners = node[listenerKey] != null ? node[listenerKey] : node[listenerKey] = [];
    listeners.push(listener);
    return this;
  };

  return EventEmitterWildcard;

})(EventEmitter);
