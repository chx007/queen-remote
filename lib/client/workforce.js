var EventEmitter = require('events').EventEmitter,
	its = require('its'),
	createWorker = require('./worker.js').create;

var utils = require('../utils.js'),
	MESSAGE_TYPE = require('../protocol.js').WORKFORCE_MESSAGE_TYPE;

var create = exports.create = function(getWorkerProvider, socket, onSendToSocket, options){
	var workforce = new Workforce(getWorkerProvider, socket, onSendToSocket);

	if(options.stopHandler){
		workforce.stopHandler = options.stopHandler;
		workforce.killOnStop = false;
	}

	if(options.workerHandler) workforce.workerHandler = options.workerHandler;
	if(options.providerFilter) workforce.providerFilter = options.providerFilter;
	if(options.killOnStop !== void 0) workforce.killOnStop = options.killOnStop;
	if(options.uniquenessFilter) workforce.uniquenessFilter = options.uniquenessFilter;
	
	return workforce;
};

var getApi = function(workforce){
	var api = workforce.broadcast.bind(workforce);
	api.on = workforce.emitter.on.bind(workforce.emitter);
	api.removeListener = workforce.emitter.removeListener.bind(workforce.emitter);
	api.kill = workforce.kill;
	api.stop = workforce.stop.bind(workforce);
	api.start = workforce.start.bind(workforce);
	api.populate = workforce.populate.bind(workforce);
	api.runUrl = workforce.runUrl;
	
	return api;
};

var Workforce = exports.Workforce = function(getWorkerProvider, socket, onSendToSocket){
	its.func(getWorkerProvider, "worker provider required");
	its.func(onSendToSocket, "on send to socket required");
	its.object(socket, "socket required");
	
	this.socket = socket;
	this.getWorkerProvider = getWorkerProvider;
	this.sendToSocket = onSendToSocket;
	this.emitter = new EventEmitter();
	this.workerEmitters = {};
	this.uniquenessMap = {};

	this.kill = utils.once(this.kill.bind(this));

	socket.on('message', this.messageHandler.bind(this));

	this.api = Object.freeze(getApi(this));
};

Workforce.prototype.workerHandler = utils.noop;
Workforce.prototype.stopHandler = utils.noop;
Workforce.prototype.providerFilter = function(){return true;};
Workforce.prototype.uniquenessFilter = void 0;
Workforce.prototype.killOnStop = true;
Workforce.prototype.started = false;

Workforce.prototype.messageHandler = function(message){
	switch(message[0]){
		case MESSAGE_TYPE["worker message"]:
			this.workerMessage(message[1], message[2]);
			return;
		case MESSAGE_TYPE["worker dead"]:
			this.workerDead(message[1], message[2]);
			return;
		case MESSAGE_TYPE["add worker"]:
			this.addWorker(message[1], message[2]);
			return;
		case MESSAGE_TYPE["stop"]:
			this.stop();
			return;
	}
};

Workforce.prototype.stop = function(){
	this.stopHandler();
	if(this.killOnStop){
		this.kill();
	}
};

Workforce.prototype.start = function(){
	if(this.started) return;
	this.started = true;
	this.emitter.emit('start');
};

Workforce.prototype.kill = function(reason){
	this.sendToSocket([MESSAGE_TYPE['kill']]);

	utils.each(this.workerEmitters, function(workerEmitter){
		workerEmitter.emit('dead', ((reason === "timeout")? "workforce timeout" : "workforce dead"));
	});
	
	this.emitter.emit('dead');
	this.emitter.removeAllListeners();
};

Workforce.prototype.broadcast = function(message){
	this.sendToSocket([
		MESSAGE_TYPE['broadcast'],
		message
	]);
};

Workforce.prototype.populate = function(workerProviders){
	var self = this;

	if(!Array.isArray(workerProviders)) workerProviders = [workerProviders];
	workerProviders = workerProviders
						.filter(function(provider){
							return self.providerFilter(provider.attributes);
						});

	if(this.uniquenessFilter){
		workerProviders = workerProviders.filter(function(provider){
			var hash = self.uniquenessFilter(provider.attributes);
			if(hash in self.uniquenessMap) return false;
			self.uniquenessMap[hash] = true;
			return true;
		});
	}

	var providerIds = workerProviders.map(function(provider){ return provider.id });

	if(providerIds.length === 0) return;

	this.sendToSocket([
		MESSAGE_TYPE['populate'],
		providerIds
	]);
};

Workforce.prototype.addWorker = function(workerId, providerId){
	var self = this,
		workerId = workerId,
		workerProvider = this.getWorkerProvider(providerId),
		workerEmitter = new EventEmitter(),
		worker,
		onSendToSocket;

	onSendToSocket = function(message){
		self.sendToSocket([
			MESSAGE_TYPE['worker message'],
			workerId,
			message
		]);
	};

	worker = createWorker(workerId, workerProvider, workerEmitter, onSendToSocket);

	this.workerEmitters[workerId] = workerEmitter;
	worker.on('dead', function(reason){
		self.sendToSocket([
			MESSAGE_TYPE['worker dead'],
			workerId,
			reason
		]);
		var workerEmitter = self.workerEmitters[workerId];
		if(workerEmitter !== void 0){
			delete self.workerEmitters[workerId];
		}

		// Remove the provider from the uniqueness map so another may join if
		// this workforce is continous		
		if(self.uniquenessFilter){
			var hash = self.uniquenessFilter(worker.provider.attributes);
			if(hash in self.uniquenessMap){
				delete self.uniquenessMap[hash];	
			}
		}
	});

	worker.on('message', function(message){
		self.emitter.emit('message', message, worker);
	});

	this.workerHandler(worker);
	this.emitter.emit("worker", worker);
};

Workforce.prototype.workerDead = function(workerId, reason){
	var workerEmitter = this.workerEmitters[workerId];

	if(workerEmitter === void 0) return;

	workerEmitter.emit('dead', reason);
};

Workforce.prototype.workerMessage = function(workerId, workerMessage){
	var workerEmitter = this.workerEmitters[workerId];

	if(workerEmitter === void 0) return;

	workerEmitter.emit('message', workerMessage);
}
