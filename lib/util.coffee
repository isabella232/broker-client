exports.emitToChannel = (ctx, channel, event, rest...) ->

  return  if channel.isForwarder and
             event not in ['cycleChannel', 'setSecretNames']

  oldChannelEvent = channel.event  if channel.event?
  channel.event = ctx.event

  channel.emit event, rest...

  if oldChannelEvent?
  then channel.event = oldChannelEvent
  else delete channel.event

  return