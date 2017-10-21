"use strict";

const net = require("net");
const log = require("libs/log")(module);
const config = require("config");

function Server(port)
{
    var self = this;
    var clients = [];
    var broadcast_callbacks = [];

    this.countClients = function()
    {
        var ret = 0;
        clients.forEach((cl) =>
        {
            if (cl.verified) ret++;
        });
        return ret;
    };
    this.onconnection = function(addr)
    {
        log.error("Please override onconnection callback");
    };
    this.onclose = function(addr)
    {
        log.error("Please override onclose callback");
    };
    this.command = function(addr, cmd, callback)
    {
        if (clients[addr])
        {
            clients[addr].callbacks[cmd] = callback;
            clients[addr].socket.write(cmd);
        }
        else log.error("Unknown address", addr);
    };
    this.broadcast = function(cmd, callback)
    {
        var callbacks =
        {
            callback: callback,
            left: 0,
            result: {},
        };
        for (var prop in clients)
        {
            var client = clients[prop];
            if (client && client.verified)
            {
                callbacks.left++;
                client.socket.write(cmd);
            }
        }
        if (callbacks.left > 0)
        {
            broadcast_callbacks[cmd] = callbacks;
            callbacks.timer = setTimeout(() =>
            {
                if (broadcast_callbacks[cmd])
                {
                    broadcast_callbacks[cmd].callback("error");
                    broadcast_callbacks[cmd].callback = null;
                }
            }, config.get("master-server:timeout-broadcast"));

        }
        else callback("");
    };
    this.listen = function()
    {
        log.debug("TCP server listening port", port);

        net.createServer(function(sock)
        {
            var address = sock.remoteAddress + ':' + sock.remotePort;
            log.debug("New connection:", address);
            clients[address] =
            {
                socket: sock,
                callbacks: [],
                verified: false,
            };

            sock.on("data", function(data)
            {
                if (data.toString("utf-8") === "instagib.io")
                {
                    log.debug("Client", address, "verified");
                    clients[address].verified = true;
                    self.onconnection(address);
                }
                else if (clients[address].verified === true)
                {
                    var res = data.toString("utf-8").split('&');
                    log.assert(res.length === 2);
                    const cmd = res[0];
                    const result = res[1];

                    if (broadcast_callbacks[cmd])
                    {
                        const broad = broadcast_callbacks[cmd];
                        broad.result[address] = result;
                        broad.left--;
                        if (broad.left === 0 && broad.callback)
                        {
                            broadcast_callbacks[cmd] = null;
                            clearTimeout(broad.timer);
                            broad.callback(broad.result);
                        }
                    }
                    else
                    {
                        log.assert(clients[address].callbacks[cmd], "Don't find callback " + cmd);
                        clients[address].callbacks[cmd](result);
                        clients[address].callbacks[cmd] = null;
                    }
                }
                else
                {
                    log.debug("Not verified client sended", data.toString("utf-8"));
                }
            });

            sock.on("close", function(data)
            {
                var verified = clients[address].verified;
                if (verified)
                {
                    for (var cmd in clients[address].callbacks)
                    {
                        var callback = clients[address].callbacks[cmd];
                        if (callback)
                        {
                            log.debug("callback for", cmd);
                            clients[address].callbacks[cmd]("error");
                        }
                    }
                }
                clients[address] = null;
                log.debug("Closed", address);
                if (verified) self.onclose(address);
            });

            sock.on("error", function()
            {
                log.error("Socket error for", address);
            });

        }).listen(port, "localhost");
    };
}

function Client(host, port)
{
    var self = this;
    var client = new net.Socket();
    client.on("close", function()
    {
        log.debug("Connection with server was lost");
    });
    client.on("data", function(cmd)
    {
        var cmdstr = cmd.toString("utf-8");
        self.oncommand(cmdstr, function(res)
        {
            client.write(cmdstr + '&' + res);
        });
    });

    this.connect = function()
    {
        log.debug("Try connect to", host, ":", port);
        client.connect(port, host, function()
        {
            log.debug("Connected to server");
            client.write("instagib.io");
        });
    };
    this.oncommand = function(cmd, callback)
    {
        log.error("Please override oncommand function");
        callback("error");
    };
    this.disconnect = function()
    {
        log.debug("Try disconnecting");
        client.destroy();
    };
}

module.exports.Server = Server;
module.exports.Client = Client;
