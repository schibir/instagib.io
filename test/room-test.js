"use strict";

var Room = require("../game-server/room/common/room").Room;
var Event = require("../game-server/room/common/libs/event").Event;
var Console = require("libs/log")(module);

const seed = 42;
const size_class = 2;
const websocket_port = 8099;
var room = new Room(seed, size_class, websocket_port);

Event.on("botadded", function(bot)
{
    Console.debug("added new bot", bot.nick);
});

var game = room.getGame();
game.onclose = () => {};

var time = 0;
var count = 0;

var getTable = function(max_row)
{
    var ret = [];
    ret.push("\t\tfrag\tdeath\tSK\tDK\tTK\tMK\tsniper\tkiller\tavenger\tlooser\tS+\tS-\tTF\tTFd\tscores");
    
    var bots = [];
    game.bots.forEach(function(bot)
    {
        bots.push(bot);
    });
    bots.sort(function(a, b)
    {
        return b.stats.scores - a.stats.scores;
    });

    for (var i = 0; i < bots.length; i++)
    {
        if (i > 10 && (i + 2) % 10 !== 0) continue;
        var bot = bots[i];
        var str = "" + (i + 1);
        if (bot.isKiller()) str += "\x1b[31m";
        else if (!bot.isLooser()) str += "\x1b[33m";
        else str += "\x1b[0m";
        str += "\t" + bot.nick.substr(0, 15);
        str += "\t" + bot.stats.frag;
        str += "\t" + bot.stats.death;
        str += "\t" + bot.stats.selfkill;
        str += "\t" + bot.stats.doublekill;
        str += "\t" + bot.stats.triplekill;
        str += "\t" + bot.stats.multikill;
        str += "\t" + bot.stats.snipercount;
        str += "\t" + bot.stats.killercount;
        str += "\t" + bot.stats.avenger;
        str += "\t" + bot.stats.loosercount;
        str += "\t" + bot.stats.maxseria;
        str += "\t" + bot.stats.maxantiseria;
        str += "\t" + bot.stats.telefrag;
        str += "\t" + bot.stats.telefraged;
        str += "\t" + (bot.stats.scores | 0);
        str += "\x1b[0m";
        ret.push(str);
    }
    return ret;
}

setInterval(function()
{
    process.stdout.write("\x1Bc");
    var table = getTable(20);
    table.forEach(function(row)
    {
        console.log(row);
    });
    time += game.getFrameTime();
    count++;
    Console.info(process.memoryUsage(), "time", time / count | 0);
}, 1000);
