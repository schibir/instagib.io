"use strict";

var Console = require("libs/log")(module);
var Event = require("../../../game-server/room/common/libs/event").Event;

function fakeSend(event, data)
{
    const PING = 16;
    setTimeout(function()
    {
        Event.emit(event, data);
    }, PING);
}

function FakeSocketClient(port, my_ip)
{
    Console.assert(port && my_ip);
    Console.debug("Connecting to fake server", port, "from", my_ip);
    fakeSend("fakeconnection" + port, my_ip);

    var self = this;
    this.binaryType = "unknown";

    this.onmessage = function(e)
    {
        Console.assert("Please override onmessage callback");
    };
    this.onopen = function()
    {
        Console.assert("Please override onopen callback");
    };
    this.onclose = function(e)
    {
        Console.assert("Please override onclose callback");
    };
    this.onerror = function(e)
    {
        Console.assert("Please override onerror callback");
    };
    this.send = function(data)
    {
        fakeSend("fakeclientsend" + port, { data: data, ip: my_ip });
    };

    Event.on("fakeopen" + my_ip, function()
    {
        Console.debug(my_ip, ": onopen");
        self.onopen();
    });
    Event.on("fakeserversend" + my_ip, function(e)
    {
        self.onmessage(e);
    });
    Event.on("fakeclose", function(e)
    {
        Console.debug(my_ip, ": onclose");
        self.onclose(e);
    });
    Event.on("fakeerror", function(e)
    {
        Console.debug(my_ip, ": onerror");
        self.onerror(e);
    });
}

var FakeServer = {};

FakeServer.Server = function(param)
{
    Console.debug("FakeServer listening port:", param.port);

    var events = [];
    var clients = [];

    function emit(event_name, ...param)
    {
        var event = events[event_name];
        if (event && event.callback)
        {
            event.callback(...param);
        }
    }

    function FakeSocketServer(ip)
    {
        this.on = function(event_name, callback)
        {
            events[event_name + ip] = { callback : callback };
        };
        this.send = function(data, param)
        {
            fakeSend("fakeserversend" + ip, { data : data });
        };
        this.ip = ip;
    }

    Event.on("fakeconnection" + param.port, function(host)
    {
        var client = new FakeSocketServer(host);
        clients.push(client);
        emit("connection", client);
        fakeSend("fakeopen" + host);
        emit("open" + host);
    });
    Event.on("fakeclientsend" + param.port, function(data)
    {
        var ip = data.ip;
        emit("message" + ip, data.data);
    });

    this.on = function(event_name, callback)
    {
        events[event_name] = { callback : callback };
    };
};

exports.FakeSocketClient = FakeSocketClient;
exports.FakeServer = FakeServer;
