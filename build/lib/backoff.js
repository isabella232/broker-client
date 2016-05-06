module.exports = function(ctx, options) {
  var initalDelayMs, maxDelayMs, maxReconnectAttempts, multiplyFactor, ref, ref1, ref2, ref3, ref4, totalReconnectAttempts;
  if (!options) {
    ref = [ctx, options], options = ref[0], ctx = ref[1];
  }
  if (options == null) {
    options = {};
  }
  if (ctx == null) {
    ctx = this;
  }
  totalReconnectAttempts = 0;
  initalDelayMs = (ref1 = options.initialDelayMs) != null ? ref1 : 700;
  multiplyFactor = (ref2 = options.multiplyFactor) != null ? ref2 : 1.4;
  maxDelayMs = (ref3 = options.maxDelayMs) != null ? ref3 : 1000 * 15;
  maxReconnectAttempts = (ref4 = options.maxReconnectAttempts) != null ? ref4 : 50;
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
