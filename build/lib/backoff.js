module.exports = function(ctx, options) {
  var initalDelayMs, maxDelayMs, maxReconnectAttempts, multiplyFactor, totalReconnectAttempts, _ref, _ref1, _ref2, _ref3, _ref4;
  if (!options) {
    _ref = [ctx, options], options = _ref[0], ctx = _ref[1];
  }
  if (options == null) {
    options = {};
  }
  if (ctx == null) {
    ctx = this;
  }
  totalReconnectAttempts = 0;
  initalDelayMs = (_ref1 = options.initialDelayMs) != null ? _ref1 : 700;
  multiplyFactor = (_ref2 = options.multiplyFactor) != null ? _ref2 : 1.4;
  maxDelayMs = (_ref3 = options.maxDelayMs) != null ? _ref3 : 1000 * 15;
  maxReconnectAttempts = (_ref4 = options.maxReconnectAttempts) != null ? _ref4 : 50;
  ctx.clearBackoffTimeout = function() {
    return totalReconnectAttempts = 0;
  };
  ctx.setBackoffTimeout = (function(_this) {
    return function(attemptFn, failFn) {
      var timeout;
      if (totalReconnectAttempts < maxReconnectAttempts) {
        timeout = Math.min(initalDelayMs * Math.pow(multiplyFactor, totalReconnectAttempts), maxDelayMs);
        setTimeout(attemptFn, timeout);
        return totalReconnectAttempts++;
      } else {
        return failFn();
      }
    };
  })(this);
  return ctx;
};
