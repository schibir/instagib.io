"use strict";

const log = require("libs/log")(module);
const config = require("config");
const GameInstance = require("./game-instance");

var port_for_room = config.get("game-server:port-for-room");
if (!port_for_room)
{
    log.error("Please set port for room: npm run game -- --game-server:port-for-room=[port]");
    process.exit();
}

var game = new GameInstance(port_for_room, "./game-server/room/index.js");