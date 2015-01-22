bound_ = require './bound'

module.exports = class Channel extends `KDEventEmitter`

  constructor:(@name, @routingKeyPrefix, options)->
    super
    @isOpen = yes
    { @isReadOnly, @isSecret, @isExclusive, @isP2P, @exchange, @mustAuthenticate } = options
    if @isExclusive or @isP2P
      @eventRegister = []
      @trackListener = (event, listener)=>
        @eventRegister.push { event, listener }
        @consumerChannel?.on event, listener  unless event is 'publish'

  publish:(rest...)->
    @emit 'publish', rest...  unless @isReadOnly

  close:->
    @isOpen = no
    @emit 'close'

  cycle:-> @emit 'cycle'  if @isOpen

  pipe:(channel)->
    @on event, listener  for { event, listener } in channel.eventRegister \
                         when event isnt 'publish'
    @on 'message', (message)-> channel.emit 'message', message

  setAuthenticationInfo:(@authenticationInfo)->

  getAuthenticationInfo:-> @authenticationInfo

  isListeningTo:(event)->
    listeners = @_e?[event]
    listeners and (Object.keys listeners).length > 0

  setSecretName:(@secretName)->

  interrupt: -> @isOpen = no

  resume: -> @isOpen = yes

  bound: bound_
