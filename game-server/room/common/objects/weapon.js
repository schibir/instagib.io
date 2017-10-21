"use strict";

var Event = require("../libs/event").Event;
var Vector = require("../libs/vector").Vector;
var Bullet = require("./bullet").Bullet;
var ITEM = require("../game/global").constants.ITEM;
var WEAPON = require("../game/global").constants.WEAPON;

function Weapon(owner)
{
    this.type = WEAPON.PISTOL;
    this.owner = owner;
    this.next_shoot = 0;

    this.patrons = [1, 0, 0, 0, 0, 0];
}

Weapon.prototype.set = function(type)
{
    this.type = type;
};

Event.on("takeweapon", function(bot, type, patrons)
{
    bot.weapon.patrons[type] += patrons;
    if ((type > bot.weapon.type && bot.weapon.patrons[type] === patrons) || bot.weapon.type === WEAPON.PISTOL)
    {
        bot.weapon.set(type);
    }
});

Weapon.prototype.next = function()
{
    for (var type = this.type + 1; type <= WEAPON.ROCKET; type++)
    {
        if (this.patrons[type] > 0) 
        {
            this.set(type);
            break;
        }
    }
};

Weapon.prototype.prev = function()
{
    for (var type = this.type - 1; type >= WEAPON.PISTOL; type--)
    {
        if (this.patrons[type] > 0) 
        {
            this.set(type);
            break;
        }
    }
};

Weapon.prototype.shoot = function()
{
    if (Date.now() > this.next_shoot)
    {
        if (this.type != WEAPON.PISTOL && this.patrons[this.type] <= 0)
        {
            this.prev();
            return;
        }

        var Y = 0.9;
        var angle = this.owner.dynent.angle;
        if (this.type === WEAPON.PISTOL)
        {
            angle += (Math.random() * 2 - 1) * Math.PI / 100;
        }

        var sina = Math.sin(angle);
        var cosa = Math.cos(angle);
        var position = Vector.add2(this.owner.dynent.pos, cosa * 0.25 - sina * Y, -cosa * Y - sina * 0.25);
        
        //for collision
        var center = Vector.add(position, this.owner.dynent.pos).mul(0.5);
        if (this.owner.game.level.getCollide(center) > 128)
            return;
        
        Event.emit("shoot", this.owner, this.type);
        if (this.type >= WEAPON.PLASMA)
        {
            var bul = new Bullet(this.type, position, angle, this.owner);
            bul.ai_check = true;
            bul.id = this.owner.game.getBulletId();
            this.owner.game.bullets.push(bul);
            Event.emit("bulletrespawn", bul, true);
        }
        else
        {
            new Bullet(this.type, position, angle, this.owner);
        }
        if (this.type !== WEAPON.SHAFT)
        {
            if (this.type !== WEAPON.PISTOL) this.patrons[this.type]--;
        }
        else
        {
            this.patrons[this.type] -= WEAPON.FRAME_DELTA_TIME;
        }

        var power = this.owner.power === ITEM.QUAD ? WEAPON.ROCKET + 1 : 0;
        if (this.type === WEAPON.ZENIT)
        {
            var count = power ? 19 : 9;
            for (var i = 0; i < count; i++)
            {
                var my_angle = angle + (Math.random() * 2 - 1) * Math.PI / 15;
                bul = new Bullet(this.type, position, my_angle, this.owner);
                bul.ai_check = false;
                bul.id = this.owner.game.getBulletId();
                this.owner.game.bullets.push(bul);
                Event.emit("bulletrespawn", bul, false);
            }
        }
        
        this.next_shoot = Date.now() + WEAPON.wea_tabl[this.type + power].period;
        this.owner.last_shoot_time = Date.now();
    }
};

//Static methods

Weapon.update = function(game)
{
    for (var index = 0; index < game.bullets.length;)
    {
        var bullet = game.bullets[index];
        if (bullet.update(Date.now()))
        {
            index++;
        }
        else
        {
            Event.emit("bulletdead", bullet);
            //calc damage with rocket
            if (bullet.type == WEAPON.ROCKET)
            {
                for (var i = 0; i < bullet.owner.game.bots.length; i++)
                {
                    var bot = bullet.owner.game.bots[i];
                    if (!bot.alive)
                        continue;

                    var len = Vector.sub(bullet.dynent.pos, bot.dynent.pos).length();
                    var damage = (1 - len / WEAPON.RADIUS_ROCKET) * WEAPON.wea_tabl[bullet.type].damage;
                    if (damage > 0)
                    {
                        bot.pain(damage, bullet.owner, { pos: bullet.dynent.pos, type: bullet.type });
                    }
                }
            }
            game.bullets.splice(index, 1);
        }
    }
};

exports.Weapon = Weapon;