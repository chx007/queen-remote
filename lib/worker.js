var	generateId = require('node-uuid').v4,
	_ = require('underscore'),
	precondition = require('precondition'),
	utils = require('./utils.js');
	
exports.create = function(id, provider, emitter, onSendToSocket){
	precondition.checkDefined(emitter, "An emitter is required for workers");

	var worker = new Worker(id, provider, emitter, onSendToSocket);

	return worker.api;
};

var Worker = exports.Worker = function(id, provider, emitter, onSendToSocket){
	var self = this;

	this.id = id;
	this.provider = provider;
	this.emitter = emitter;
	this.sendToSocket = onSendToSocket;
	this.kill = _.once(this.kill.bind(this));

	emitter.on('dead', function(){
		self.kill = utils.noop;
		self.emitter.removeAllListeners();
	});

	Object.defineProperty(this, "api", { 
		value: Object.freeze(getApi.call(this)),
		enumerable: true 
	});
};

var getApi = function(){
	var self = this,
		api = this.sendToSocket.bind(this);

	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.kill = this.kill;
	api.id = this.id;

	Object.defineProperty(api, "provider", {
		get: function(){ return self.provider},
		enumerable: true
	});

	return api;
};

Worker.prototype.kill = function(){
	this.emitter.emit('dead');
};
