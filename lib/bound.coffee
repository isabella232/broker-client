module.exports = (method) ->
  throw new Error "@bound: unknown method! #{method}"  unless @[method]?
  boundMethod = "__bound__#{method}"
  boundMethod of this or Object.defineProperty(
    this, boundMethod, value: @[method].bind this
  )
  return @[boundMethod]
