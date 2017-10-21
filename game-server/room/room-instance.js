"use strict";

const log = require("libs/log")(module);
const Client = require("libs/net").Client;
const config = require("config");

function RoomInstance(seed, size_class, port_for_game, Room)
{
    const websocket_port = config.get("game-server:start-websocket-port");
    var room = new Room(seed, size_class, parseInt(websocket_port));

    var client_for_game = new Client("localhost", port_for_game);
    client_for_game.oncommand = function(cmd, callback)
    {
        if (cmd === "count-empty-slots") callback(room.getGame().countEmptySlots());
        else if (cmd === "get-port") callback(room.getPort());
        else
        {
            log.error("Unknown command", cmd);
            callback("error");
        }
    };
    client_for_game.connect();

    log.html("New room created with port = " + room.getPort());

    this.destroy = function()
    {
        log.html("Room correctly drop with port = " + room.getPort());
        client_for_game.disconnect();
        room.destroy();
        process.exit();
    };

    room.getGame().onclose = this.destroy;
}

module.exports = RoomInstance;