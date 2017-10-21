"use strict";

var Event = require("../libs/event.js").Event;
var Vector = require("../libs/vector.js").Vector;
var EVENT = require("../game/global.js").constants.EVENT;
var WEAPON = require("../game/global.js").constants.WEAPON;

function GameEvent(type, pos, dir, arg1, arg2)
{
    this.type = type;
    this.pos = new Vector(pos);
    this.dir = dir ? new Vector(dir) : null;
    this.arg1 = arg1;
    this.arg2 = arg2;
}

Event.on("botrespawn", function(bot)
{
    bot.game.events.push(new GameEvent(EVENT.BOT_RESPAWN, bot.dynent.pos, null));
});

Event.on("botpain", function(bot, bullet)
{
    if (bullet && bullet.type !== WEAPON.RAIL)
    {
        var dir = Vector.sub(bullet.pos, bot.dynent.pos);
        var pos = bullet.type === WEAPON.ROCKET ? bot.dynent.pos : bullet.pos;
        bot.game.events.push(new GameEvent(EVENT.PAIN, pos, dir, bot.id));
    }
});

Event.on("botdead", function(bot, killer, bullet, isLava)
{
    //gibs
    var dir = new Vector(0, 0);
    if (bullet)
    {
        if (bullet.type === WEAPON.ROCKET)
        {
            dir = Vector.sub(bot.dynent.pos, bullet.pos);
            var force = 1 - dir.length() / WEAPON.RADIUS_ROCKET;
            if (force < 0) force = 0;
            dir.mul(force * 0.02);
        }
        else if (bullet.type === WEAPON.PLASMA)
        {
            dir = Vector.sub(bot.dynent.pos, bullet.pos).normalize().mul(0.004);
        }
        else if (bullet.type === WEAPON.ZENIT)
        {
            dir = Vector.normalize(bullet.vel).mul(0.01);
        }
    }
    bot.game.events.push(new GameEvent(EVENT.BOT_DEAD, bot.dynent.pos, dir, bot.id));
});

Event.on("takeweapon", function(bot, type, val)
{
    bot.game.events.push(new GameEvent(EVENT.TAKE_WEAPON, bot.dynent.pos, null));
});

Event.on("takehealth", function(bot)
{
    bot.game.events.push(new GameEvent(EVENT.TAKE_HEALTH, bot.dynent.pos, null));
});

Event.on("takeshield", function(bot)
{
    bot.game.events.push(new GameEvent(EVENT.TAKE_SHIELD, bot.dynent.pos, null));
});

Event.on("takepower", function(bot, type)
{
    bot.game.events.push(new GameEvent(EVENT.TAKE_POWER, bot.dynent.pos, null));
});

Event.on("itemrespawn", function(item)
{
    item.game.events.push(new GameEvent(EVENT.ITEM_RESPAWN, item.dynent.pos, null));
});

Event.on("bulletdead", function(bullet)
{
    bullet.owner.game.events.push(new GameEvent(EVENT.BULLET_DEAD, bullet.dynent.pos, null, bullet));
});

Event.on("lineshoot", function(bullet)
{
    bullet.owner.game.events.push(new GameEvent(EVENT.LINE_SHOOT, bullet.dynent.pos, null, bullet));
});

Event.on("bulletrespawn", function(bullet, sound)
{
    bullet.owner.game.events.push(new GameEvent(EVENT.BULLET_RESPAWN, bullet.dynent.pos, null, bullet, sound));
});

exports.GameEvent = GameEvent;