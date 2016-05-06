var Channel, EventEmitter, bound_,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

bound_ = require('./bound');

EventEmitter = require('./eventemitter');

module.exports = Channel = (function(superClass) {
  extend(Channel, superClass);

  function Channel(name, routingKeyPrefix, options) {
    this.name = name;
    this.routingKeyPrefix = routingKeyPrefix;
    Channel.__super__.constructor.apply(this, arguments);
    this.isOpen = true;
    this.isReadOnly = options.isReadOnly, this.isSecret = options.isSecret, this.isExclusive = options.isExclusive, this.isP2P = options.isP2P, this.exchange = options.exchange, this.mustAuthenticate = options.mustAuthenticate;
    if (this.isExclusive || this.isP2P) {
      this.eventRegister = [];
      this.trackListener = (function(_this) {
        return function(event, listener) {
          var ref;
          _this.eventRegister.push({
            event: event,
            listener: listener
          });
          if (event !== 'publish') {
            return (ref = _this.consumerChannel) != null ? ref.on(event, listener) : void 0;
          }
        };
      })(this);
    }
  }

  Channel.prototype.publish = function() {
    var rest;
    rest = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    if (!this.isReadOnly) {
      return this.emit.apply(this, ['publish'].concat(slice.call(rest)));
    }
  };

  Channel.prototype.close = function() {
    this.isOpen = false;
    return this.emit('close');
  };

  Channel.prototype.cycle = function() {
    if (this.isOpen) {
      return this.emit('cycle');
    }
  };

  Channel.prototype.pipe = function(channel) {
    var event, i, len, listener, ref, ref1;
    ref = channel.eventRegister;
    for (i = 0, len = ref.length; i < len; i++) {
      ref1 = ref[i], event = ref1.event, listener = ref1.listener;
      if (event !== 'publish') {
        this.on(event, listener);
      }
    }
    return this.on('message', function(message) {
      return channel.emit('message', message);
    });
  };

  Channel.prototype.setAuthenticationInfo = function(authenticationInfo) {
    this.authenticationInfo = authenticationInfo;
  };

  Channel.prototype.getAuthenticationInfo = function() {
    return this.authenticationInfo;
  };

  Channel.prototype.isListeningTo = function(event) {
    var listeners, ref;
    listeners = (ref = this._e) != null ? ref[event] : void 0;
    return listeners && (Object.keys(listeners)).length > 0;
  };

  Channel.prototype.setSecretName = function(secretName) {
    this.secretName = secretName;
  };

  Channel.prototype.interrupt = function() {
    return this.isOpen = false;
  };

  Channel.prototype.resume = function() {
    return this.isOpen = true;
  };

  Channel.prototype.bound = bound_;

  return Channel;

})(EventEmitter);
