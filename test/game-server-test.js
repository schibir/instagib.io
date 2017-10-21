"use strict";

const log = require("libs/log")(module);
const Server = require("libs/net").Server;
const config = require("config");
const WebSocket = require("ws");
const os = require("os");

log.info("free memory", os.freemem());
log.info("os.loadavg()", os.loadavg());

const port_for_room = 9100;

var server_for_room = new Server(port_for_room);
var callback_for_create_new_room = null;
server_for_room.onconnection = function(addr)
{
    log.info("New room connected", addr);
    log.assert(callback_for_create_new_room, "Unknown callback_for_create_new_room");
    callback_for_create_new_room(addr);
    callback_for_create_new_room = null;
};
server_for_room.onclose = function(addr)
{
    log.info("Room", addr, "was disconnected");
};
server_for_room.listen();

function roomProcess(seed, size_class)
{
    const FakeRoom = require("./fake-room");
    const RoomInstance = require("../game-server/room/room-instance");

    return new RoomInstance(seed, size_class, port_for_room, FakeRoom);
}

var test = new function()
{
    var tests = [];

    this.use = function(test_name, test_fun)
    {
        tests.push({name : test_name, fun : test_fun });
    };

    function run_test(index)
    {
        if (index > tests.length - 1) return log.info("end tests");
        
        var unit = tests[index];
        log.info("Run:", unit.name);
        unit.fun(() => { run_test(index + 1); });
    }

    this.run = function()
    {
        log.info("start tests");
        run_test(0);
    };
};

function howManyEmptySlots(callback)
{
    server_for_room.broadcast("count-empty-slots", (res) =>
    {
        var ret = 0;
        for (var addr in res)
        {
            var slots = parseInt(res[addr]);
            ret += slots;
        }
        callback(ret);
    });
}

function canCreateNewRoom(callback)
{
    if (callback_for_create_new_room) return callback("no");
    server_for_room.broadcast("resource-usage", (res) =>
    {
        var memory = 0;
        var time = 0;
        for (var addr in res)
        {
            var result = res[addr];
            var splited = result.split(';');
            log.assert(splited.length === 2);
            memory += parseInt(splited[0]);
            time = Math.max(time, parseInt(splited[1]));
        }
        const max_memory_usage = config.get("game-server:max-memory-usage");
        const max_time = config.get("game-server:update-time");
        callback(memory < max_memory_usage && time < max_time ? "yes" : "no");
    });
}

function createNewRoom(callback)
{
    if (callback_for_create_new_room)
    {
        log.error("Could not create new room");
        return callback("error");
    }
    callback_for_create_new_room = callback;

    roomProcess(42, 2);
}

function addrForMostEmptyRoom(callback)
{
    server_for_room.broadcast("count-empty-slots", (res) =>
    {
        var max_slot = 0;
        var addr_for_max_slot = "";
        for (var addr in res)
        {
            var slots = parseInt(res[addr]);
            if (slots > max_slot)
            {
                max_slot = slots;
                addr_for_max_slot = addr;
            }
        }
        if (addr_for_max_slot !== "")
        callback(addr_for_max_slot);
    });
}

test.use("can create and remove room", (next) =>
{
    callback_for_create_new_room = () =>
    {
        room.destroy();
        setTimeout(next, 500);
    };

    var room = roomProcess(42, 2);
});

test.use("how many empty slots for no room", (next) =>
{
    howManyEmptySlots((res) =>
    {
        log.assert(res === 0);
        log.info("count empty slots =", res);
        next();
    });
});

test.use("can create new room for no room", (next) =>
{
    canCreateNewRoom((res) =>
    {
        log.assert(res === "yes");
        log.info("result =", res);
        next();
    });
});

test.use("create new room", (next) =>
{
    createNewRoom((res) =>
    {
        log.info("addr =", res);
        next();
    });
});

test.use("how many empty slots for 1 room", (next) =>
{
    howManyEmptySlots((res) =>
    {
        log.assert(res === 3);
        log.info("count empty slots =", res);
        next();
    });
});

test.use("connect to 1 room", (next) =>
{
    addrForMostEmptyRoom((addr) =>
    {
        log.info("addrForMostEmptyRoom =", addr);
        const ws = new WebSocket("ws://" + addr);
        ws.on("open", next);
    });
});

test.run();