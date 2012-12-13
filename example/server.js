var winston = require("winston"),
	logger = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'info'}) ]}),
	socketio = require("socket.io"),
	http = require('http'),
	createQueen = require("../../queen"), // Assumes queen in parent dir
	createRemoteServer = require("../").server,
	createStaticServer = require("../lib/staticServer.js").create;

var port = 80,
	browserCapturePath = "/capture",
	httpServer = createStaticServer({port: 80}),
	socketServer = socketio.listen(httpServer, {log: false}),
	socket = socketServer.of(browserCapturePath),
	queen = createQueen(socket, {logger: logger.info.bind(logger)}),
	controlServer = createRemoteServer(queen);