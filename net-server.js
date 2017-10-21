"use strict";

const log = require("libs/log")(module);
const Server = require("libs/net").Server;
const config = require("config");

var port_for_game_server = config.get("master-server:port-for-game-server");
var server_for_game = new Server(port_for_game_server);
server_for_game.onconnection = function(addr)
{
    log.info("New game-server connected", addr);
};
server_for_game.onclose = function(addr)
{
    log.info("Game-server", addr, "was disconnected");
};
server_for_game.listen();

function addrForMostEmptyRoom(gameAddr, callback)
{
    server_for_game.command(gameAddr, "addr-for-most-empty-room", (res) =>
    {
        if (res === "error")
        {
            log.error("addr-for-most-empty-room: bad responce", gameAddr);
            return callback("");
        }
        callback(res);
    });
}

module.exports.getGameAddr = function(callback)
{
    server_for_game.broadcast("how-many-empty-slots", (res) =>
    {
        if (res === "error")
        {
            log.error("how-many-empty-slots broadcast: bad responce");
            return callback("");
        }

        var max_empty_slots = 0;
        var game_with_max_empty_slots = "";
        
        for (var addr in res)
        {
            var result = res[addr];
            if (result === "error")
            {
                log.error("how-many-empty-slots: bad responce", addr);
                continue;
            }

            var slots = parseInt(result);
            if (slots > max_empty_slots)
            {
                max_empty_slots = slots;
                game_with_max_empty_slots = addr;
            }
        }

        if (game_with_max_empty_slots !== "")
        {
            addrForMostEmptyRoom(game_with_max_empty_slots, callback);
        }
        else
        {
            server_for_game.broadcast("can-create-new-room", function(res)
            {
                if (res === "error")
                {
                    log.error("can-create-new-room broadcast: bad responce");
                    return callback("");
                }
                
                for (var addr in res)
                {
                    var result = res[addr];
                    if (result === "error") log.error("can-create-new-room: bad responce", addr);
                    else if (result === "yes")
                    {
                        return server_for_game.command(addr, "create-new-room", (res) =>
                        {
                            if (res === "error")
                            {
                                log.error("create-new-room: bad responce", addr);
                                return callback("");
                            }
                            addrForMostEmptyRoom(addr, callback);
                        });
                    }
                }
                callback("");
            });
        }
    });
};