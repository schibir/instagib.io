"use strict";

const log = require("libs/log")(module);
const config = require("config");
const FakeRoom = require("./fake-room");
const RoomInstance = require("../game-server/room/room-instance");

const seed = config.get("seed");
const size_class = config.get("size_class");
const port_for_game = config.get("port");
if (!seed || !size_class || !port_for_game)
{
    log.error("Please set seed, size_class and port: ./game-server/room/index.js --seed=42 --size_class=2 --port=8888");
    process.exit();
}

var room = new RoomInstance(parseInt(seed), parseInt(size_class), port_for_game, FakeRoom);