"use strict";

var Event = require("../libs/event").Event;
var Vector = require("../libs/vector").Vector;
var Dynent = require("./dynent").Dynent;
var Aibot = require("../game/aibot").Aibot;
var Weapon = require("./weapon").Weapon;
var ITEM = require("../game/global").constants.ITEM;
var WEAPON = require("../game/global").constants.WEAPON;

function Bot(game, nick, id, isBot)
{
    this.game = game;
    this.nick = nick;
    this.id = id;

    //key controls
    this.key_up = false;
    this.key_left = false;
    this.key_down = false;
    this.key_right = false;
    this.shoot = false;

    this.alive = false;
    this.resp_time = 0;

    this.ai = null;

    if (isBot) this.ai = new Aibot(this);

    this.direction = new Vector(0, 0);

    Event.emit("botadded", this);
}

Bot.SPEED = 0.008;
Bot.HEALTH = 3999;

Event.on("takehealth", function(bot)
{
    bot.health = Bot.HEALTH;
});

Event.on("takeshield", function(bot)
{
    bot.shield = true;
});

Event.on("takepower", function(bot, type)
{
    bot.power = type;
    if (type === ITEM.SPEED)
    {
        bot.speed = Bot.SPEED * 1.5;
    }
    else
    {
        bot.speed = Bot.SPEED;
    }
});

Bot.prototype.respawn = function()
{
    var pos = this.game.level.getRandomPos();
    this.dynent = new Dynent(pos);
    this.health = Bot.HEALTH;
    this.weapon = new Weapon(this);
    this.alive = true;
    this.resp_time = 0;
    this.power = 0;
    this.powertime = 0;
    this.shield = false;
    this.last_shoot_time = 0;
    this.speed = Bot.SPEED;
    this.last_update = Date.now();

    Event.emit("botrespawn", this);

    var bot = null;
    do
    {
        bot = this.collide_bot(0);
        if (bot)
        {
            bot.pain(Bot.HEALTH + 1, this);
            Event.emit("telefrag", this, bot);
        }
    }
    while(bot);
};

Bot.prototype.update = function(time)
{
    var dt = time - this.last_update;
    if (dt > 30)
    {
        return this.update(this.last_update + 30) && this.update(time);
    }
    this.last_update = time;

    if (!this.alive)
        return true;

    if (this.ai)
        this.ai.update(dt);
    
    this.direction.set(0, 0);
    if (this.key_up)    this.direction.add2( 0, -1);
    if (this.key_left)  this.direction.add2(-1,  0);
    if (this.key_down)  this.direction.add2( 0,  1);
    if (this.key_right) this.direction.add2( 1,  0);
    this.direction.normalize();

    var sina = Math.sin(this.dynent.angle);
    var cosa = Math.cos(this.dynent.angle);
    var vec = new Vector(this.direction.x * cosa + this.direction.y * sina,
                         this.direction.y * cosa - this.direction.x * sina);

    this.dynent.vel = Vector.mul(vec, this.speed);
    this.dynent.update(dt);

    if (this.shoot)
        this.weapon.shoot();

    //collide map
    function collide_map(self)
    {
        var norm = self.game.level.collideMap(self.dynent.pos);
        if (norm)
        {
            norm.normalize();
            var dot = norm.dot(self.dynent.vel);
            if (dot > 0)
            {
                var delta = norm.mul(dot * dt);
                self.dynent.pos.sub(delta);
            }
        }
    }

    collide_map(this);
    this.collide_bot(dt);

    //collide_lava
    if (this.game.level.collideLava(this.dynent.pos))
    {
        var bridge = this.game.level.getCollideBridges(this.dynent.pos);
        if (bridge === null)
            this.pain(Bot.HEALTH + 1, this, null, { lava: true, });
    }

    //powerup regen
    if (this.power === ITEM.REGEN && time > this.powertime)
    {
        this.powertime = time + 100;
        this.health += 50;
        if (this.health > Bot.HEALTH) this.health = Bot.HEALTH;
    }

    return true;
};

Bot.prototype.collide_bot = function(dt)
{
    var res = null;
    for (var i = 0; i < this.game.bots.length; i++)
    {
        var bot = this.game.bots[i];
        if (bot === this)
            continue;
        if (!bot.alive)
            continue;

        var norm = this.dynent.collide(bot.dynent, bot.dynent.size.x);
        if (norm !== null)
        {
            norm.normalize();
            var dot = norm.dot(this.dynent.vel);
            if (dot > 0)
            {
                var delta = norm.mul(dot * dt);
                this.dynent.pos.sub(delta);
            }
            res = bot;
        }
    }
    return res;
};

/*
damage - count HP
opponent - bot, owner bullet
bullet.pos - position of this bullet
bullet.vel - velocity of this bullet
bullet.type - type weapon
param.lava
*/
Bot.prototype.pain = function(damage, opponent, bullet, param)
{
    if (this.shield)
    {
        damage *= 0.5;
        if (bullet && bullet.type === WEAPON.RAIL)
        {
            this.shield = false;
            damage = 0;
        }
    }
    this.health -= damage;
    if (this.health < 0)
    {
        this.dead(opponent, bullet, param);
    }
    Event.emit("botpain", this, bullet);
};

Bot.prototype.dead = function(opponent, bullet, param)
{
    this.alive = false;
    this.resp_time = Date.now() + 2000;

    var isLava = param && param.lava !== undefined && param.lava === true;
    Event.emit("botdead", this, opponent, bullet, isLava);
};

exports.Bot = Bot;