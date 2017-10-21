"use strict";

var config = require("config");
var WEAPON = require("./global").constants.WEAPON;
var Event = require("../libs/event").Event;

var gameplay =
{
    ratingkoef      : parseInt(config.get("game-server:ratingkoef")),
    ratingdiap      : parseInt(config.get("game-server:ratingdiap")),
    looserseria     : parseInt(config.get("game-server:looserseria")),
    killseria       : parseInt(config.get("game-server:killseria")),
    multikilltime   : parseInt(config.get("game-server:multikilltime")),
    quicktime       : parseInt(config.get("game-server:quicktime")),
};

gameplay.sortBots = function(allbots)
{
    var bots = [];
    allbots.forEach(function(bot)
    {
        bots.push(bot);
    });
    bots.sort(function(a, b)
    {
        return b.stats.scores - a.stats.scores;
    });
    bots.forEach(function(bot, i)
    {
        bot.stats.rank = i;
    });
    return bots;
};

gameplay._E = function(killer_scores, deaded_scores)
{
    return gameplay.ratingkoef / (1 + Math.pow(10.0, (killer_scores - deaded_scores) / gameplay.ratingdiap));
};

Event.on("botadded", function(bot)
{
    bot.stats = {};
    bot.stats.frag = 0;
    bot.stats.death = 0;
    bot.stats.doublekill = 0;
    bot.stats.triplekill = 0;
    bot.stats.multikill = 0;
    bot.stats.telefrag = 0;
    bot.stats.telefraged = 0;
    bot.stats.selfkill = 0;
    bot.stats.snipercount = 0;
    bot.stats.killercount = 0; //serial killer (5 seria)
    bot.stats.avenger = 0;
    bot.stats.loosercount = 0; //pushechnoe myaso
    bot.stats.maxseria = 0;
    bot.stats.maxantiseria = 0;
    bot.stats.currentseria = 0;
    bot.stats.currentantiseria = 0;
    bot.stats.lastkilltime = 0;
    bot.stats.currentmultikill = 0;
    bot.stats.railshootnumber = 0;
    bot.stats.lastrailkillnumber = -1;
    bot.stats.respawntime = 0;
    bot.stats.scores = 1200;
    bot.stats.rank = 0;

    bot.isLooser = function()
    {
        return this.stats.currentantiseria >= gameplay.looserseria;
    };
    bot.isKiller = function()
    {
        return this.stats.currentseria >= gameplay.killseria;
    };
    bot.stats.clear = function()
    {
        bot.stats.i_am_death = 0;   //id my killer
        bot.stats.i_am_kill = 0;    //id who I kill
        bot.stats.i_am_multi = 0;   //1 - double, 2 - triple, 3 - multi
        bot.stats.i_am_killer = false;
        bot.stats.i_am_looser = false;
        bot.stats.i_am_sniper = false;
        bot.stats.i_am_avenger = false;
        bot.stats.i_am_quickkill = false;
        bot.stats.i_am_quickdeath = false;
        bot.stats.i_am_telefraging = false;
        bot.stats.i_am_telefraged = false;
    };
    bot.stats.toString = function()
    {
        var ret = "";
        ret += "frag = " + bot.stats.frag + ", ";
        ret += "death = " + bot.stats.death + ", ";
        ret += "selfkill = " + bot.stats.selfkill + ", ";
        ret += "doublekill = " + bot.stats.doublekill + ", ";
        ret += "triplekill = " + bot.stats.triplekill + ", ";
        ret += "multikill = " + bot.stats.multikill + ", ";
        ret += "snipercount = " + bot.stats.snipercount + ", ";
        ret += "killercount = " + bot.stats.killercount + ", ";
        ret += "avenger = " + bot.stats.avenger + ", ";
        ret += "loosercount = " + bot.stats.loosercount + ", ";
        ret += "maxseria = " + bot.stats.maxseria + ", ";
        ret += "maxantiseria = " + bot.stats.maxantiseria + ", ";
        ret += "telefrag = " + bot.stats.telefrag + ", ";
        ret += "telefraged = " + bot.stats.telefraged + ", ";
        ret += "scores = " + (bot.stats.scores | 0);
        return ret;
    };

    bot.stats.clear();
});

Event.on("botrespawn", function(bot)
{
    bot.stats.currentseria = 0;
    bot.stats.lastkilltime = 0;
    bot.stats.currentmultikill = 0;
    bot.stats.railshootnumber = 0;
    bot.stats.lastrailkillnumber = -1;
    bot.stats.respawntime = Date.now();
});

Event.on("botdead", function(bot, killer, bullet, isLava)
{
    bot.stats.i_am_death = killer.id;
    killer.stats.i_am_kill = bot.id;
    if (bot === killer)
    {
        bot.stats.selfkill++;
        bot.stats.frag--;
        bot.stats.scores -= 15;
    }
    else
    {
        var koef_killer = 1;
        var koef_deader = 1;
        killer.stats.frag++;
        killer.stats.currentseria++;
        if (killer.stats.currentseria === gameplay.killseria)
        {
            killer.stats.killercount++;
        }
        if (killer.stats.currentseria >= gameplay.killseria)
        {
            koef_killer *= 2;
            killer.stats.i_am_killer = true;
            Event.emit("killer", killer);
        }
        killer.stats.maxseria = Math.max(killer.stats.maxseria, killer.stats.currentseria);
        killer.stats.currentantiseria = 0;
        if (bot.stats.currentseria >= 5)
        {
            killer.stats.avenger++;
            koef_killer *= 2;
            killer.stats.i_am_avenger = true;
            Event.emit("avenger", killer);
        }
        if (Date.now() < killer.stats.lastkilltime + gameplay.multikilltime)
        {
            killer.stats.currentmultikill++;
            if (killer.stats.currentmultikill === 1)
            {
                killer.stats.doublekill++;
                koef_killer *= 2;
                Event.emit("doublekill", killer);
            }
            else if (killer.stats.currentmultikill === 2)
            {
                killer.stats.triplekill++;
                koef_killer *= 3;
                Event.emit("triplekill", killer);
            }
            else if (killer.stats.currentmultikill > 2)
            {
                killer.stats.multikill++;
                koef_killer *= 4;
                Event.emit("multikill", killer);
            }
            killer.stats.i_am_multi = killer.stats.currentmultikill;
        }
        else
        {
            killer.stats.currentmultikill = 0;
        }
        killer.stats.lastkilltime = Date.now();
        if (bullet && bullet.type === WEAPON.RAIL)
        {
            if (killer.stats.lastrailkillnumber >= killer.stats.railshootnumber - 1)
            {
                killer.stats.snipercount++;
                koef_killer *= 2;
                killer.stats.i_am_sniper = true;
                Event.emit("sniper", killer);
            }
            killer.stats.lastrailkillnumber = killer.stats.railshootnumber;
        }
        if (Date.now() < killer.stats.respawntime + gameplay.quicktime)
        {
            koef_killer *= 2;
            killer.stats.i_am_quickkill = true;
            Event.emit("quickkill", killer);
        }

        bot.stats.currentantiseria++;
        if (bot.stats.currentantiseria === gameplay.looserseria)
        {
            bot.stats.loosercount++;
        }
        if (bot.stats.currentantiseria >= gameplay.looserseria)
        {
            koef_deader *= 2;
            bot.stats.i_am_looser = true;
            Event.emit("looser", bot);
        }
        bot.stats.maxantiseria = Math.max(bot.stats.maxantiseria, bot.stats.currentantiseria);
        if (Date.now() < bot.stats.respawntime + gameplay.quicktime)
        {
            bot.stats.i_am_quickdeath = true;
            Event.emit("quickdeath", bot);
        }

        var updelta = gameplay._E(killer.stats.scores, 1200);
        killer.stats.scores += updelta * koef_killer;
        var downdelta = gameplay._E(1200, bot.stats.scores);
        bot.stats.scores -= downdelta * koef_deader;
    }
    bot.stats.death++;
});

Event.on("telefrag", function(bot, opponent)
{
    bot.stats.telefrag++;
    opponent.stats.telefraged++;
    bot.stats.scores += 15;
    bot.stats.i_am_telefraging = true;
    opponent.stats.i_am_telefraged = true;
});

Event.on("shoot", function(bot, bullet_type)
{
    if (bullet_type === WEAPON.RAIL)
    {
        bot.stats.railshootnumber++;
    }
    else
    {
        bot.stats.railshootnumber = 0;
        bot.stats.lastrailkillnumber = -1;
    }
});

exports.gameplay = gameplay;