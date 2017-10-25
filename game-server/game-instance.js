"use strict";

const log = require("libs/log")(module);
const Server = require("libs/net").Server;
const Client = require("libs/net").Client;
const config = require("config");
const spawn = require("child_process").spawn;
const os = require("os");

function GameInstance(port_for_room, room_path)
{
    var callback_for_create_new_room = null;
    var server_for_room = new Server(port_for_room);
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
        var room = spawn("node", [room_path, "--seed=" + seed, "--size_class=" + size_class, "--port=" + port_for_room]);
            room.stderr.on("data", (err) =>
            {
                console.log(`room ${room.pid} ${err}`);
            });
            room.on("close", (code) =>
            {
                log.info(`room ${room.pid} exited with code ${code}`);
            })
            .unref();

        log.info("Spawned new room", room.pid);
    }

    function howManyEmptySlots(callback)
    {
        server_for_room.broadcast("count-empty-slots", (res) =>
        {
            if (res === "error")
            {
                log.error("count-empty-slots broadcast: bad responce");
                return callback("error");
            }

            var ret = 0;
            for (var addr in res)
            {
                var result = res[addr];
                if (result === "error")
                {
                    log.error("count-empty-slots: bad responce", addr);
                    continue;
                }
                var slots = parseInt(result);
                ret += slots;
            }
            callback(ret);
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

        const seed = parseInt(config.get("game-server:seed"));
        const size = parseInt(config.get("game-server:size"));

        roomProcess(seed, size);
    }

    function canCreateNewRoom(callback)
    {
        if (callback_for_create_new_room) return callback("no");
        //os.loadavg();
        //os.freemem();
        callback(server_for_room.countClients() < 1 ? "yes" : "no");
    }

    function addrForMostEmptyRoom(callback)
    {
        server_for_room.broadcast("count-empty-slots", (res) =>
        {
            if (res === "error")
            {
                log.error("count-empty-slots broadcast: bad responce");
                return callback("error");
            }

            var max_slots = 0;
            var addr_for_max_slots = "";
            for (var addr in res)
            {
                var result = res[addr];
                if (result === "error")
                {
                    log.error("count-empty-slots: bad responce", addr);
                    continue;
                }
                var slots = parseInt(result);
                if (slots > max_slots)
                {
                    max_slots = slots;
                    addr_for_max_slots = addr;
                }
            }
            if (addr_for_max_slots !== "")
            {
                server_for_room.command(addr_for_max_slots, "get-port", (res) =>
                {
                    if (res === "error")
                    {
                        log.error("get-port: bad responce", addr_for_max_slots);
                        return callback("error");
                    }

                    require("dns").lookup(os.hostname(), (err, addr, fam) =>
                    {
                        if (err)
                        {
                            log.error("dns.getAddr:", err);
                            return callback("error");
                        }
                        callback(addr + ':' + res);
                    })
                });
            }
            else callback("error");
        });
    }

    const host_for_game_server = config.get("master-server:host-for-game-server");
    const port_for_game_server = config.get("master-server:port-for-game-server");
    var client_for_master = new Client(host_for_game_server, port_for_game_server);
    client_for_master.oncommand = function(cmd, callback)
    {
        if (cmd === "how-many-empty-slots") howManyEmptySlots(callback);
        else if (cmd === "can-create-new-room") canCreateNewRoom(callback);
        else if (cmd === "create-new-room") createNewRoom(callback);
        else if (cmd === "addr-for-most-empty-room") addrForMostEmptyRoom(callback);
        else
        {
            log.error("Unknown command", cmd);
            callback("error");
        }
    };
    client_for_master.connect();
}

module.exports = GameInstance;