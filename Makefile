BIN=./node_modules/.bin

bundle:
	@$(BIN)/browserify -g coffeeify --extension=".coffee" -o bundle.js index.coffee