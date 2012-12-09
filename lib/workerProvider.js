exports.create = function(id, emitter, attributes){
	var workerProvider = new WorkerProvider(id, emitter, attributes);

	return Object.freeze(getApi.call(workerProvider));
};

var WorkerProvider = exports.WorkerProvider = function(id, emitter, attributes){
	this.id = id;
	this.emitter = emitter;
	this.attributes = Object.freeze(attributes);
	this.emitter.on('message', this.messageHandler.bind(this));
};

var getApi = function(){
	var api = {};
	api.on = this.emitter.on.bind(this.emitter);
	api.removeListener = this.emitter.removeListener.bind(this.emitter);
	api.attributes = this.attributes;
	api.id = this.id;

	return api;
};

WorkerProvider.prototype.unavailableHandler = function(){
	this.available = false;
	this.emitter.emit('unavailable');
};

WorkerProvider.prototype.availableHandler = function(){
	this.available = true;
	this.emitter.emit('available');
};

WorkerProvider.prototype.workerHandler = function(message){
	this.emitter.emit('worker', {
		id: message.id
	});
};

WorkerProvider.prototype.workerDeadHandler = function(message){
	this.emitter.emit('workerDead', message.id);
};

WorkerProvider.prototype.messageHandler = function(message){
	switch(message.type){
		case "available":
			this.availableHandler();
			break;
		case "unavailable":
			this.unavailableHandler();
			break;
		case "worker":
			this.workerHandler(message);
			break;
		case "workerDead":
			this.workerDeadHandler(message);
			break;
	}
};