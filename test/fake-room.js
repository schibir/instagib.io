"use strict";

const WebSocket = require("ws");
const log = require("libs/log")(module);

function FakeRoom(seed, size_class, port)
{
    var count_users = 0;
    var socket = new WebSocket.Server({ port: port });
    socket.on("connection", function(ws)
    {
        count_users++;
        log.info("new connection");
    });
    socket.on("close", function()
    {
        count_users--;
        log.info("client disconected");
    });

    this.getGame = function()
    {
        return { countEmptySlots: () => { return Math.max(0, 3 - count_users); } };
    };
    this.getPort = function()
    {
        return prot;
    };
    this.destroy = function()
    {
        socket.close();
    };
}

module.exports = FakeRoom;