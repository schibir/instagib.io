"use strict";

var exports = {};
var module = {};

function assert(condition, message)
{
    if (!condition)
    {
        message = message || "Assertion failed";
        Console.error(message);
        if (typeof Error !== "undefined")
        {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}

function require(file)
{
    if (file === "libs/log")
    {
        return function()
        {
            return Console;
        }
    }
    else if (file === "config") return config;
    else if (file === "ws") return FakeServer;
    return exports;
}

var config =
{
    get: function(key)
    {
        var subkeys = key.split(':');
        if (subkeys.length === 2)
        {
            assert(subkeys[0] === "game-server");
            if (subkeys[1] === "item-respawn-time") return 5000;
            else if (subkeys[1] === "update-time") return 50;
            else if (subkeys[1] === "looserseria") return 5;
            else if (subkeys[1] === "killseria") return 5;
            else if (subkeys[1] === "ratingkoef") return 15;
            else if (subkeys[1] === "ratingdiap") return 1000;
            else if (subkeys[1] === "multikilltime") return 2000;
            else if (subkeys[1] === "quicktime") return 2000;
            else if (subkeys[1] === "timeout-for-destroy-room") return 30000;
        }
        assert(false, "Unknown config parameters:" + key);
    },
};