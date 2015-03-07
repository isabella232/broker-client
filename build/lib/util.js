var __slice = [].slice;

exports.emitToChannel = function() {
  var channel, ctx, event, oldChannelEvent, rest;
  ctx = arguments[0], channel = arguments[1], event = arguments[2], rest = 4 <= arguments.length ? __slice.call(arguments, 3) : [];
  if (channel.isForwarder && (event !== 'cycleChannel' && event !== 'setSecretNames')) {
    return;
  }
  if (channel.event != null) {
    oldChannelEvent = channel.event;
  }
  channel.event = ctx.event;
  channel.emit.apply(channel, [event].concat(__slice.call(rest)));
  if (oldChannelEvent != null) {
    channel.event = oldChannelEvent;
  } else {
    delete channel.event;
  }
};
