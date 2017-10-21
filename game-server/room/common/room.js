"use strict";

function Room(seed, size_class, port)
{
    var Console = require("libs/log")(module);
    var Game = require("./game/game").Game;
    var Transport = require("./game/transport").Transport;
    var config = require("config");
    var WebSocket = require("ws");

    var game = new Game(size_class, seed);
    game.start();

    var socket = new WebSocket.Server({ port: port });
    socket.on("connection", function(ws)
    {
        Console.info("new connection");

        var transport = new Transport(ws, game);
        game.clients.push(transport);
    });

    this.getGame = function()
    {
        return game;
    };
    this.getPort = function()
    {
        return port;
    };
    this.destroy = function()
    {
        game.stop();
        socket.close();
    };
}

exports.Room = Room;