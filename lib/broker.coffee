SockJS = require 'sockjs-client'

bound_ = require './bound'
backoff = require './backoff'
EventEmitterWildcard = require './eventemitterwildcard'
trace = ->

module.exports = class Broker extends EventEmitterWildcard

  [NOTREADY, READY, CLOSED] = [0,1,3]

  Channel = require './channel'

  createId = require 'hat'

  { emitToChannel } = require './util'

  constructor:(ws, options)->
    super()
    @sockURL = ws
    { @autoReconnect, @authExchange
      @overlapDuration, @servicesEndpoint
      @getSessionToken, @brokerExchange
      @tryResubscribing, debug } = options

    trace = console.log if debug
    trace "broker constructor called", ws, options

    @overlapDuration ?= 3000
    @authExchange ?= 'auth'
    @brokerExchange ?= 'broker'
    @readyState = NOTREADY
    @channels = {}
    @namespacedEvents = {}
    @subscriptions = {}
    @tryResubscribing ?= yes

    @pendingSubscriptions = []
    @pendingUnsubscriptions = []

    @subscriptionThrottleMs = 2000
    @unsubscriptionThreshold = 40

    @readyState = READY
    @emit 'ready'
    @emit 'connected'
    trace "fake init"

    return
    @initBackoff options.backoff  if @autoReconnect
    @connect()

  initBackoff: backoff

  setP2PKeys:(channelName, { routingKey, bindingKey }, serviceType)->
    channel = @channels[channelName]
    return  unless channel

    channel.close()

    consumerChannel = @subscribe bindingKey,
      exchange    :'chat'
      isReadOnly  : yes
      isSecret    : yes
    consumerChannel.setAuthenticationInfo { serviceType }
    consumerChannel.pipe channel

    producerChannel = @subscribe routingKey,
      exchange    : 'chat'
      isReadOnly  : no
      isSecret    : yes
    producerChannel.setAuthenticationInfo { serviceType }

    channel.off 'publish'
    channel.on 'publish', producerChannel.bound 'publish'

    channel.consumerChannel = consumerChannel
    channel.producerChannel = producerChannel

    return channel

  bound: bound_

  onopen:->
    @ws?.removeEventListener @bound 'onopen'

    @clearBackoffTimeout()  if @autoReconnect

    @once 'broker.connected', (newSocketId) =>
      @socketId = newSocketId
      @emit 'ready'

      @resubscribe()  if @readyState is CLOSED

      @readyState = READY
      @emit 'ready'

    @emit 'connected'

  onclose:->
    # persist latest state
    @setConnectionData()
    @readyState = CLOSED
    @emit "disconnected", Object.keys @channels
    channel.interrupt()  for own _, channel of @channels
    if @autoReconnect
      process.nextTick =>
        @connectAttemptFail()

  connectAttemptFail: ->
    if @autoReconnect
      @setBackoffTimeout(
        @bound "connect"
        @bound "connectFail"
      )

  # selectAndConnect: (blacklist = [])->
  #   xhr = new XMLHttpRequest
  #   endPoint = unless blacklist.length then @servicesEndpoint \
  #              else "#{@servicesEndpoint}?all"
  #   xhr.open 'GET', endPoint
  #   xhr.onreadystatechange = =>
  #     # 0     - connection failed
  #     # >=400 - http errors
  #     if xhr.status is 0 or xhr.status >= 400
  #       @connectAttemptFail()
  #       return this

  #     return  if xhr.readyState isnt 4
  #     return  if xhr.status not in [200, 304]

  #     response = JSON.parse xhr.responseText
  #     @sockURL = "#{
  #       if Array.isArray response
  #       then chooseBroker response, blacklist
  #       else response
  #     }/subscribe"
  #     @connectDirectly()
  #   xhr.send()
  #   return this

  # chooseBroker = (response, blacklist) ->
  #   # serviceEndpoint publishes brokers in randomized manner
  #   return response[0]  unless blacklist.length
  #   brokers = response.filter (broker) ->
  #     broker not in blacklist

  #   unless brokers.length
  #     console.warn "broker filter is bypassed"
  #     return getRandomBroker response

  #   return getRandomBroker brokers

  # getRandomBroker = (brokers) ->
  #   brokers[Math.floor(Math.random() * brokers.length)]

  connect:->
    trace "broker/connect"

    @ws = new SockJS @sockURL, null, {
      protocols_whitelist : ['xhr-polling', 'xhr-streaming']
    }

    @ws.addEventListener 'open', @bound 'onopen'
    @ws.addEventListener 'close', @bound 'onclose'
    @ws.addEventListener 'message', @bound 'handleMessageEvent'
    @ws.addEventListener 'message', =>
      @lastTo = Date.now()
      @emit 'messageArrived'
    return this

  disconnect:(reconnect=true)->
    trace "broker/disconnect", reconnect

    @autoReconnect = !!reconnect  if reconnect?
    @ws?.close()
    return this

  # connect:->
  #   if @servicesEndpoint?
  #   then @selectAndConnect()
  #   else @connectDirectly()
  #   return this

  connectFail:->
      trace "broker/connectFail", reconnect

      @emit 'connectFailed'

  createRoutingKeyPrefix:(name, options = {})->
    {isReadOnly, suffix} = options
    name += suffix or ''
    if isReadOnly then name
    else "client.#{name}"

  wrapPrivateChannel:(channel)->
    trace "broker/wrapPrivateChannel", channel

    channel.on 'cycle', => @authenticate channel
    channel.on 'setSecretNames', (secretName)=>

      {isReadOnly} = channel

      channel.setSecretName secretName
      channel.isForwarder = yes # no more messages from upstream

      consumerChannel = @subscribe secretName.publishingName, {
        isReadOnly
        isSecret: yes
        exchange: channel.exchange
      }
      consumerChannel.setAuthenticationInfo {
        serviceType: 'secret'
        wrapperRoutingKeyPrefix: channel.routingKeyPrefix
      }

      channel.consumerChannel = consumerChannel

      consumerChannel.on 'cycleChannel', ->
        channel.oldConsumerChannel = channel.consumerChannel
        channel.cycle()

      unless isReadOnly
        channel.on 'publish', (rest...)-> consumerChannel.publish rest...

      @swapPrivateSourceChannel channel

      channel.emit 'ready'

  swapPrivateSourceChannel:(channel)->
    {consumerChannel, oldConsumerChannel} = channel
    if oldConsumerChannel?
      setTimeout =>

        oldConsumerChannel.close().off()
        delete channel.oldConsumerChannel

        consumerChannel.pipe channel

      , @overlapDuration
    else
      consumerChannel.pipe channel

  registerNamespacedEvent: (name) ->
    register = @namespacedEvents
    register[name] ?= 0
    register[name] += 1
    return register[name] is 1

  createChannel: (name, options) ->
    trace "broker/createChannel", name, options

    return @channels[name]  if @channels[name]?

    # TODO: let's try to trim the fat a bit; the below has too many options:
    { isReadOnly, isSecret, isExclusive,
      isPrivate, isP2P, suffix, exchange, mustAuthenticate } = options

    suffix ?= if isExclusive then ".#{createId 32}" else ''

    routingKeyPrefix = @createRoutingKeyPrefix name, { suffix, isReadOnly }
    channel = new Channel name, routingKeyPrefix, {
      isReadOnly
      isSecret
      isP2P
      isExclusive: isExclusive ? isPrivate
      exchange
      mustAuthenticate
    }

    # handle authentication once the broker is subscribed.
    @on 'broker.subscribed', handler = (routingKeyPrefixes) =>
      trace "broker/broker.subscribed", routingKeyPrefixes

      for prefix in routingKeyPrefixes.split ' ' when prefix is routingKeyPrefix
        @authenticate channel
        @off 'broker.subscribed', handler
        channel.emit 'broker.subscribed', channel.routingKeyPrefix
        return

    # messages that are routed to the bare routingKey will be interpretted
    # as "message" events
    @on routingKeyPrefix, (rest...) ->
      unless channel.isForwarder then channel.emit 'message', rest...

    channel.on 'newListener', (event, listener) =>
      if channel.isExclusive or channel.isP2P
        channel.trackListener event, listener
      unless event is 'broker.subscribed'
        namespacedEvent = "#{routingKeyPrefix}.#{event}"
        needsToBeRegistered = @registerNamespacedEvent namespacedEvent
        if needsToBeRegistered
          # add the namespaced listener, but forward the event only
          @on namespacedEvent, (rest...) =>
            emitToChannel this, channel, event, rest...

    unless isSecret
      channel.on 'auth.authOk', -> channel.isAuthenticated = yes

    channel.once 'error', channel.bound 'close'
    channel.once 'close', => @unsubscribe channel.name
    @wrapPrivateChannel channel  if isExclusive or isPrivate

    # when the channel emits a publish event, we want to actually publish the
    # message to the broker.
    unless isPrivate or isReadOnly
      channel.on 'publish', (options, payload) =>
        [payload, options] = [options, payload]  unless payload?

        exchange = options?.exchange ? channel.exchange ? channel.name

        @publish { exchange, routingKey: channel.name }, payload

    @channels[name] = channel
    return channel

  authenticate: (channel) ->
    trace "broker/authenticate", channel

    if channel.mustAuthenticate
      authInfo = {}
      authInfo[key] = val  for own key, val of channel.getAuthenticationInfo()
      authInfo.routingKey = channel.routingKeyPrefix
      authInfo.brokerExchange = @brokerExchange
      @publish @authExchange, authInfo
    else
      process.nextTick -> channel.emit 'auth.authOk'

  handleMessageEvent: (event) ->
    trace "broker/handleMessageEvent", event

    message = event.data
    @emit 'rawMessage', message
    @emit message.routingKey, message.payload  if message.routingKey
    return

  ready: (listener) ->
    trace "broker/ready"
    if @readyState is READY then process.nextTick listener
    else @once 'ready', listener

  send: (data) ->
    trace "broker/send", data
    @emit 'send', data
    @ready =>
      try @ws?._transport.doSend JSON.stringify data
      catch e then @disconnect()
    return this

  publish: (options, payload) ->
    trace "broker/publish", options, payload

    @emit 'messagePublished'

    if 'string' is typeof options
      routingKey = exchange = options
    else
      { routingKey, exchange } = options
    routingKey = @createRoutingKeyPrefix routingKey
    payload = JSON.stringify payload  unless 'string' is typeof payload
    @send {
      action: 'publish'
      exchange
      routingKey
      payload
    }
    return this

  resubscribeBySocketId:(socketId, failCallback)->
    trace "broker/resubscribeBySocketId", socketId

    return failCallback?() unless socketId
    @send { action: 'resubscribe', socketId }
    @once 'broker.resubscribed', (found) =>
      if found
        for own _, channel of @channels
          channel.resume()
          channel.emit 'broker.subscribed'
        @setConnectionData()
      else
        failCallback?()

  resubscribeByOldSocketId: (failCallback=->)->
    trace "broker/resubscribeByOldSocketId", @tryResubscribing
    return failCallback() unless @tryResubscribing

    oldSocket = @getConnectionData()
    return failCallback() unless oldSocket

    {clientId, socketId} = oldSocket
    if @getSessionToken() is clientId
      @resubscribeBySocketId socketId, -> failCallback()
    else
      # if clientId has changed clear the oldsocketId
      @setConnectionData()
      failCallback()

  resubscribeBySubscriptions: ->
    # replay any existing subscriptions after reconnecting.

    routingKeyPrefix =
      (rk  for own _, { routingKeyPrefix : rk } of @subscriptions).join ' '

    @sendSubscriptions routingKeyPrefix

    @once 'broker.subscribed', (routingKeyPrefixes)=>
      for prefix in routingKeyPrefixes.split ' '
        for own _, channel of @channels
          if channel?.routingKeyPrefix is prefix
            channel.resume()
            channel.emit 'broker.subscribed'

  resubscribe: (callback) ->
    trace "broker/resubscribe"

    @resubscribeByOldSocketId =>
      @resubscribeBySocketId @socketId, =>
        @resubscribeBySubscriptions()
        @setConnectionData()

  subscribe: (name, options={}, callback) ->
    trace "broker/subscribe"

    channel = @channels[name]
    unless channel?
      isSecret    = !!options.isSecret
      isExclusive = !!options.isExclusive
      isReadOnly  =
        if options.isReadOnly?
        then !!options.isReadOnly
        else isExclusive
      isPrivate   = !!options.isPrivate
      isP2P       = !!options.isP2P
      mustAuthenticate = options.mustAuthenticate ? yes
      {suffix, exchange} = options
      routingKeyPrefix = @createRoutingKeyPrefix name, {isReadOnly}
      @subscriptions[name] = { name, routingKeyPrefix, arguments }
      channel = @channels[name] = @createChannel name, {
        isReadOnly, isSecret, isExclusive, isPrivate
        isP2P, suffix, exchange, mustAuthenticate
      }

      if options.connectDirectly
        @sendSubscriptions channel.routingKeyPrefix
      else
        @enqueueSubscription channel.routingKeyPrefix

    if callback?
      @on 'broker.subscribed', handler = (routingKeyPrefixes)=>
        trace "broker/broker.subscribed", routingKeyPrefixes

        for prefix in routingKeyPrefixes.split ' ' when prefix is routingKeyPrefix
          @off 'broker.subscribed', handler
          callback prefix
          return
    return channel

  enqueueSubscription: (routingKeyPrefix) ->
    trace "broker/enqueueSubscription", routingKeyPrefix
    i = @pendingUnsubscriptions.indexOf routingKeyPrefix
    if i is -1
      len = @pendingSubscriptions.push routingKeyPrefix
      @triggerSubscriptions()  if len is 1
    else
      @pendingUnsubscriptions.splice i, 1

    return this

  triggerSubscriptions: ->
    trace "broker/triggerSubscriptions"
    setTimeout =>
      { pendingSubscriptions } = this
      @pendingSubscriptions = []
      # do not send request to the broker
      # if we dont have any pendingSubscriptions
      if pendingSubscriptions.length > 0
        @sendSubscriptions pendingSubscriptions.join ' '
    , @subscriptionThrottleMs

    return this

  sendSubscriptions:(subscriptions)->
    trace "broker/sendSubscriptions", subscriptions
    @send {
      action: 'subscribe'
      routingKeyPrefix: subscriptions
    }

  enqueueUnsubscription: (routingKeyPrefix) ->
    trace "broker/enqueueUnsubscription", routingKeyPrefix

    i = @pendingSubscriptions.indexOf routingKeyPrefix
    if i is -1
      len = @pendingUnsubscriptions.push routingKeyPrefix
      @sendUnsubscriptions()  if len >= @unsubscriptionThreshold
    else
      @pendingSubscriptions.splice i, 1

    return this

  sendUnsubscriptions: ->
    trace "broker/sendUnsubscriptions", sendUnsubscriptions
    { pendingUnsubscriptions } = this
    @send {
      action: 'unsubscribe'
      routingKeyPrefix: pendingUnsubscriptions.join ' '
    }
    @removeSubscriptionKey key  for key in pendingSubscriptions

    return this

  unsubscribe: (name) ->
    trace "broker/  unsubscribe", name
    prefix = @createRoutingKeyPrefix name
    @send {
      action: 'unsubscribe'
      routingKeyPrefix: prefix
    }
    @removeSubscriptionKey name

    return this

  removeSubscriptionKey: (name) ->
    delete @channels[name]
    delete @subscriptions[name]

    return this

  ping: (callback) ->
    trace "broker/ping", name
    @send { action: "ping" }
    @once "broker.pong", callback  if callback?

  getConnectionData:->
    data = localStorage.getItem "connectiondata"
    return JSON.parse data if data

  setConnectionData:->
    trace "broker/setConnectionData"
    data = JSON.stringify {clientId: @getSessionToken(), socketId: @socketId }
    localStorage.setItem "connectiondata", data
