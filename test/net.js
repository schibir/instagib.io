"use strict";

const log = require("libs/log")(module);
const Server = require("libs/net").Server;
const Client = require("libs/net").Client;

var server = new Server(8081);
server.onconnection = function(addr)
{
    server.command(addr, "hello", function(res)
    {
        log.info(addr, "responded", res);
        server.command(addr, "guano", function(res)
        {
            log.info(addr, "responded", res);
        });
    });
};
server.listen();

var client1 = new Client("localhost", 8081);
client1.oncommand = function(cmd, callback)
{
    if (cmd === "hello") callback("world");
    else if (cmd === "hi") callback("ok");
    else callback("unknown");
};
client1.connect();

var client2 = new Client("localhost", 8081);
client2.oncommand = function(cmd, callback)
{
    if (cmd === "hello") callback("world 2");
    else if (cmd === "hi") callback("ok2");
    else callback("unknown");
};
client2.connect();

setInterval(function()
{
    server.broadcast("hi", function(res)
    {
        for (var prop in res)
        {
            log.info("host:", prop, "res:", res[prop]);
        }
    });
}, 1000);