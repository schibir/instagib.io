
var Console = require("libs/log")(module);
var FakeSocketClient = require("../public/game/client/fakesocket").FakeSocketClient;
var server = require("../public/game/client/fakesocket").FakeServer;

var socket = new server.Server({ port: 8080 });
socket.on("connection", function(ws)
{
    Console.info("SERVER: new connection from", ws.ip);

    ws.on("message", function(data)
    {
        Console.info(ws.ip, ":", data);
        ws.send("SERVER: Hello client", { binary : true });
    });
    ws.on("close", function()
    {
        Console.info("SERVER: Socket on server was closed");
    });    
});

var client1 = new FakeSocketClient("8080", "1");
client1.binaryType = "arraybuffer";

client1.onopen = function()
{
    Console.info("CLIENT: 1 onopen");
    client1.send("Hello");
};
client1.onmessage = function(e)
{
    Console.info("CLIENT: 1 onmessage", e);
};
client1.onclose = function(e)
{
    Console.info("CLIENT: 1 onclose");
};
client1.onerror = function(e)
{
    Console.info("CLIENT: 1 onerror");
};

var client2 = new FakeSocketClient("8080", "2");
client2.binaryType = "arraybuffer";

client2.onopen = function()
{
    Console.info("CLIENT: 2 onopen");
    client2.send("Hello server");
};
client2.onmessage = function(e)
{
    Console.info("CLIENT: 2 onmessage", e);
};
client2.onclose = function(e)
{
    Console.info("CLIENT: 2 onclose");
};
client2.onerror = function(e)
{
    Console.info("CLIENT: 2 onerror");
};