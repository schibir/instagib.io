"use strict";

var Console = require("libs/log")(module);
var Event = require("../libs/event").Event;
var Vector = require("../libs/vector").Vector;
var normalizeAngle = require("../libs/utility").normalizeAngle;
var cameraCulling = require("../objects/dynent").cameraCulling;
var ITEM = require("./global").constants.ITEM;
var WEAPON = require("./global").constants.WEAPON;
var itemForEach = require("../objects/item").itemForEach;

function Forbidden(max_count)
{
    this.max_count = max_count;
    this.waypoints = [];
}

Forbidden.prototype.push = function(way)
{
    this.waypoints.push(way);
    if (this.waypoints.length > this.max_count)
        this.waypoints.splice(0, 1);
}

Forbidden.prototype.clear = function()
{
    this.waypoints.splice(0, this.waypoints.length);
}

Forbidden.prototype.check = function(way)
{
    for (var i = 0; i < this.waypoints.length; i++)
        if (this.waypoints[i] === way)
            return true;
    return false;
}

function Aibot(owner)
{
    this.owner = owner;
    this.reaction_time = 200 + (Math.random() * 300 | 0);
    this.angle_speed = 1 + Math.random();
    this.max_angle_speed = 1 + Math.random();
    this.accuracy = Math.random() * Math.random();
    if (owner.nick === "lyaguha")
    {
        this.reaction_time = 200;
        this.angle_speed = 2;
        this.max_angle_speed = 2;
        this.accuracy = 1;
    }
}

Event.on("botrespawn", function(bot)
{
    if (bot.ai)
    {
        bot.ai.state = Aibot.STATE_AFTER_RESPAWN;
        bot.ai.state_move = Aibot.STATE_MOVE_STAY;
        bot.ai.state_head = Aibot.STATE_HEAD_STAY;
        bot.ai.reaction = Date.now() + bot.ai.reaction_time;
        bot.ai.item = null;
        bot.ai.bot = null;
        bot.ai.bot_last_visible_time = 0;
        bot.ai.shooted_bot = null;
        bot.ai.danger_pos = null;
        bot.ai.point = null;
        bot.ai.bot_point = null;
        bot.ai.waypoint_master = null;
        bot.ai.waypoint_next = null;
        bot.ai.diff = null;
        bot.ai.forbidden = null;
        bot.ai.attack_time = 0;
        bot.ai.attack_point = null;
    }
});

Aibot.OBJECT_VISIBLE_OFFSET_X = 9;
Aibot.OBJECT_VISIBLE_OFFSET_TOP = 9;
Aibot.OBJECT_VISIBLE_OFFSET_BOTTOM = -0.5;

Aibot.prototype.update = function(dt)
{
    var game = this.owner.game;
    var level = game.level;
    var AI = level.getAI();

    function stay(self)
    {
        self.owner.key_up = false;
        self.owner.key_left = false;
        self.owner.key_down = false;
        self.owner.key_right = false;
    }
    function moveTo(self, pos)
    {
        var dir = Vector.sub(pos, self.owner.dynent.pos);
        if (dir.length2() < 0.25 * 0.25)
            return dir;

        stay(self);

        dir.normalize().rotate(self.owner.dynent.angle);
        if (dir.x > Math.cos(Math.PI / 4 + Math.PI / 8)) self.owner.key_right = true;
        if (dir.x < -Math.cos(Math.PI / 4 + Math.PI / 8)) self.owner.key_left = true;
        if (dir.y < -Math.sin(Math.PI / 4 - Math.PI / 8)) self.owner.key_down = true;
        if (dir.y > Math.sin(Math.PI / 4 - Math.PI / 8)) self.owner.key_up = true;
        return null;
    }
    function angleTo(self, pos, koef)
    {
        var dir_to_pos = Vector.sub(pos, self.owner.dynent.pos);
        var angle = normalizeAngle(dir_to_pos.angle() - Math.PI / 2);
        var delta = normalizeAngle(angle - self.owner.dynent.angle);
        if (delta > Math.PI) delta = delta - 2 * Math.PI;
        koef = koef || self.angle_speed;
        var update_angle = delta * (koef / 20);
        if (update_angle > self.max_angle_speed / 20) update_angle = self.max_angle_speed / 20;
        if (update_angle < -self.max_angle_speed / 20) update_angle = -self.max_angle_speed / 20;
        self.owner.dynent.angle = normalizeAngle(self.owner.dynent.angle + update_angle * dt / 16);
        return delta;
    }
    function findItem(self)
    {
        var my_pos = self.owner.dynent.pos;
        var finded = false;
        var min_dir = 256 * 256;
        var item_priority = [];
        item_priority[ITEM.SPEED] = 1;
        item_priority[ITEM.QUAD] = 2;
        item_priority[ITEM.REGEN] = 3;
        var priority = item_priority[self.owner.power] || 0;

        if (self.item && self.item.alive)
        {
            min_dir = Vector.sub(my_pos, self.item.dynent.pos).length2();
            finded = true;
        }

        itemForEach(game, function(item)
        {
            var prior = item_priority[item.type] || 0;
            if (prior > 0 && prior < priority)
                return;
            if (cameraCulling(self.owner.dynent, item.dynent.pos, item.dynent.size,
                    Aibot.OBJECT_VISIBLE_OFFSET_X, Aibot.OBJECT_VISIBLE_OFFSET_TOP, Aibot.OBJECT_VISIBLE_OFFSET_BOTTOM))
                return;

            var item_pos = item.dynent.pos;
            var len = Vector.sub(my_pos, item_pos).length2();

            if (len < min_dir && AI.isVisible(my_pos, item_pos, 1.5, AI.OBJECT_VISIBLE_DIST))
            {
                min_dir = len;
                self.item = item;
                finded = true;
            }
        });
        return finded;
    }
    function botVisible(self, dynent)
    {
        if (cameraCulling(self.owner.dynent, dynent.pos, dynent.size,
                Aibot.OBJECT_VISIBLE_OFFSET_X, Aibot.OBJECT_VISIBLE_OFFSET_TOP, Aibot.OBJECT_VISIBLE_OFFSET_BOTTOM))
            return false;

        return AI.botVisible(self.owner.dynent.pos, dynent.pos);
    }
    function findBot(self)
    {
        if (self.bot)
        {
            if (botVisible(self, self.bot.dynent))
            {
                self.bot_last_visible_time = Date.now();
                return true;
            }
            if (Date.now() < self.bot_last_visible_time + 500)
                return true;
        }

        for (var i = 0; i < game.bots.length; i++)
        {
            var bot = game.bots[i];
            if (bot === self.owner || !bot.alive)
                continue;

            if (botVisible(self, bot.dynent))
            {
                self.bot_last_visible_time = Date.now();
                self.bot = bot;
                return true;
            }
        }
        return false;
    }
    function findShootedBot(self)
    {
        if (self.bot)
            return false;

        for (var i = 0; i < game.bots.length; i++)
        {
            var bot = game.bots[i];
            if (bot === self.owner || !bot.alive)
                continue;
            if (Date.now() > bot.last_shoot_time + 500)
                continue;

            if (AI.botVisible(self.owner.dynent.pos, bot.dynent.pos))
            {
                self.shooted_bot = bot;
                return true;
            }
        }
        return false;
    }
    function findBullet(self)
    {
        var a = self.owner.dynent.pos;
        var v = self.owner.dynent.vel;
        var danger_pos = null;
        var danger_time = 5000;
        for (var i = 0; i < game.bullets.length; i++)
        {
            var bullet = game.bullets[i];
            if (bullet.ai_check && bullet.owner !== self.owner)
            {
                if (!botVisible(self, bullet.dynent))
                    continue;

                var b = bullet.dynent.pos;
                var w = bullet.dynent.vel;
                var t = (a.dot(w) + b.dot(v) - a.dot(v) - b.dot(w)) /
                        Vector.sub(v, w).length2();
                var A = Vector.add(a, Vector.mul(v, t));
                var B = Vector.add(b, Vector.mul(w, t));
                var distance = Vector.sub(A, B).length2();

                var bullet_table =
                [
                    0, 0, 0, 0.5, 3, WEAPON.RADIUS_ROCKET,
                ];

                var min_distance = bullet_table[bullet.type];
                if (distance < min_distance * min_distance && t < danger_time)
                {
                    danger_time = t;
                    danger_pos = B;
                }
            }
        }
        if (danger_pos)
        {
            self.danger_pos = danger_pos;
            return true;
        }
        return false;
    }
    function findObject(self)
    {
        var item_finded = findItem(self);
        var bot_finded = findBot(self);
        var bul_finded = findBullet(self);
        var shb_finded = findShootedBot(self);
        if (item_finded || bot_finded || bul_finded)
        {
            self.state = Aibot.STATE_CHECK_OBJECT;
        }

        if (bul_finded)
        {
            var my_pos = self.owner.dynent.pos;
            self.point = Vector.add(my_pos, Vector.sub(my_pos, self.danger_pos).normalize());
            self.state_move = Aibot.STATE_MOVE_TO_POINT_SAFE;
        }
        else if (item_finded)
        {
            self.point = new Vector(self.item.dynent.pos);
            self.state_move = Aibot.STATE_MOVE_TO_POINT;
        }
        else if (bot_finded)
        {
            self.state_move = Aibot.STATE_ATTACK;
        }

        if (bot_finded)
        {
            self.bot_point =
            {
                pos: new Vector(self.bot.dynent.pos),
                vel: new Vector(self.bot.dynent.vel),
                time: Date.now(),
            };
            self.state_head = Aibot.STATE_HEAD_BOT;
            var random_vector = new Vector(2 * Math.random() - 1, 2 * Math.random() - 1);
            random_vector.mul(3 * (1 - self.accuracy));
            self.bot_point.pos.add(random_vector);
        }
        else if (shb_finded)
        {
            self.state_head = Aibot.STATE_HEAD_SHOOTED;
            self.point_head = new Vector(self.shooted_bot.dynent.pos);
        }
        else if (item_finded)
        {
            self.state_head = Aibot.STATE_HEAD_POINT;
            self.point_head = self.point;
        }
        return item_finded || bot_finded || bul_finded;
    }
    function checkNext(self)
    {
        var ret = false;
        var my_pos = self.owner.dynent.pos;
        var dir_to_master = Vector.sub(my_pos, self.waypoint_master.pos);
        var len = dir_to_master.length2();
        if (len < 1 || AI.isVisible(my_pos, self.waypoint_next.pos))
        {
            self.forbidden.push(self.waypoint_master);
            self.waypoint_master = self.waypoint_next;

            var radius = self.waypoint_master.isBridge() ? 1 : self.waypoint_master.dist;
            self.diff = new Vector(radius, 0).rotate(Math.PI * 2 * Math.random());
            chooseNext(self, false);
            ret = true;
        }
        return ret;
    }
    function getMostFronted(self, ways)
    {
        var pos = self.owner.dynent.pos;
        var dir = new Vector(-Math.sin(self.owner.dynent.angle), -Math.cos(self.owner.dynent.angle));
        var max_dot = -2;
        var way_with_max_dot = null;
        ways.forEach(function(way)
        {
            var to = Vector.sub(way.pos, pos).normalize();
            var dot = to.dot(dir);
            if (dot > max_dot)
            {
                max_dot = dot;
                way_with_max_dot = way;
            }
        });
        return way_with_max_dot;
    }
    function resetMaster(self, way)
    {
        self.waypoint_master = way;
        self.forbidden = new Forbidden(5);
        self.diff = null;
        chooseNext(self, true);
        self.state_move = Aibot.STATE_MOVE_TO_MASTER;
        self.state_head = Aibot.STATE_HEAD_SMOOTH_WAYPOINT;
        self.state = Aibot.STATE_CHECK_NEXT;
    }
    function resetState(self)
    {
        var ways = AI.getVisibleWaypoint(self.owner.dynent);
        if (ways.length > 0)
        {
            var way = getMostFronted(self, ways);
            Console.assert(way);
            resetMaster(self, way);
        }
        else
        {
            self.state = Aibot.STATE_FIND_MASTER;
        }
    }
    function chooseNext(self, fronted_next, protect)
    {
        var next = [];
        self.waypoint_master.next.forEach(function(n)
        {
            if (!self.forbidden.check(n))
                next.push(n);
        });

        if (next.length === 0)
        {
            Console.assert(protect === undefined)
            self.forbidden.clear();
            chooseNext(self, fronted_next, "protect");
        }
        else
        {
            if (fronted_next)
            {
                self.waypoint_next = getMostFronted(self, next);
            }
            else
            {
                var id = Math.random() * next.length | 0;
                self.waypoint_next = next[id];
            }
        }
    }
    function safeMove(self)
    {
        var pos = new Vector(self.owner.dynent.pos);
        var safe = level.getSafetyDir(pos);
        if (safe)
        {
            var dir = Vector.normalize(self.owner.dynent.vel);
            if (dir.dot(safe) > 0)
            {
                var random_vector = new Vector(2 * Math.random() - 1,
                                               2 * Math.random() - 1).mul(0.5);
                safe.mul(-1).normalize().add(random_vector);
                pos.add(safe);
                return pos;
            }
        }
        return null;
    }
    function moveToPoint(self, point)
    {
        var dir = moveTo(self, point);
        if (dir)
        {
            point.add(dir.normalize());
        }
    }
    function chooseWeapon(self, prior_rocket = 5)
    {
        var prior = [0, 2, 3, 1, 4, prior_rocket];
        var type_with_max_prior = WEAPON.PISTOL;
        for (var w = WEAPON.PISTOL; w <= WEAPON.ROCKET; w++)
        {
            if (self.owner.weapon.patrons[w] > 0 &&
                prior[w] > prior[type_with_max_prior])
            {
                type_with_max_prior = w;
            }
        }
        self.owner.weapon.set(type_with_max_prior);
    }
    function calcDirection(a, b, v, len)
    {
        var A = v.length2() - len * len;
        var dir = Vector.sub(b, a);
        var B = 2 * v.dot(dir);
        var C = dir.length2();
        var D = B * B - 4 * A * C;
        if (D < 0) return 0;
        var sqrtD = Math.sqrt(D);
        var t = (-B - sqrtD) / (2 * A);
        return t;
    }

    var ai_update = false;
    if (Date.now() > this.reaction)
    {
        ai_update = true;
        this.reaction = Date.now() + this.reaction_time;
    }

    switch (this.state)
    {
        case Aibot.STATE_AFTER_RESPAWN:
        {
            this.state_move = Aibot.STATE_MOVE_STAY;
            this.state_head = Aibot.STATE_HEAD_STAY;
            if (ai_update)
            {
                this.state = Aibot.STATE_FIND_MASTER;
            }
            break;
        }
        case Aibot.STATE_FIND_MASTER:
        {
            this.state_move = Aibot.STATE_MOVE_GRADIENT;
            this.state_head = Aibot.STATE_HEAD_FRONT;
            var ways = AI.getVisibleWaypoint(this.owner.dynent);
            if (ways.length > 0)
            {
                var id = Math.random() * ways.length | 0;
                resetMaster(this, ways[id]);
            }
            else if (ai_update)
            {
                findObject(this);
            }
            break;
        }
        case Aibot.STATE_CHECK_NEXT:
        {
            checkNext(this);
            if (ai_update)
            {
                findObject(this);
            }
            break;
        }
        case Aibot.STATE_CHECK_OBJECT:
        {
            if (ai_update)
            {
                if (this.bot && !this.bot.alive)
                {
                    this.bot = null;
                }
                if (this.item && !this.item.alive)
                {
                    this.item = null;
                }
                if (!findObject(this))
                {
                    resetState(this);
                }
                chooseWeapon(this);
            }
            break;
        }
    }

    switch (this.state_move)
    {
        case Aibot.STATE_MOVE_STAY:
            stay(this);
            break;
        case Aibot.STATE_MOVE_TO_MASTER:
        {
            var vec = new Vector(this.waypoint_master.pos);
            if (this.diff)
            {
                var dir = Vector.sub(vec, this.owner.dynent.pos);
                var len = dir.length() - 1;
                var radius = this.diff.length();
                if (len < radius)
                {
                    vec.add(Vector.mul(this.diff, len / radius));
                }
            }
            moveTo(this, vec);
            break;
        }
        case Aibot.STATE_MOVE_TO_POINT:
        {
            moveToPoint(this, this.point);
            break;
        }
        case Aibot.STATE_MOVE_TO_POINT_SAFE:
        {
            var pos = safeMove(this);
            if (pos) this.point = pos;
            moveToPoint(this, this.point);
            break;
        }
        case Aibot.STATE_MOVE_GRADIENT:
        {
            var my_pos = new Vector(this.owner.dynent.pos);
            var grad = AI.getGradient(my_pos);
            my_pos.add(grad);
            moveTo(this, my_pos);
            break;
        }
        case Aibot.STATE_ATTACK:
        {
            if (Date.now() > this.attack_time)
            {
                this.attack_time = Date.now() + 500 + 1500 * Math.random();
                var my_pos = this.owner.dynent.pos;
                var dir = Vector.sub(this.bot_point.pos, my_pos).binormalize();
                if (Math.random() < 0.5) dir.mul(-1);
                this.attack_point = Vector.add(my_pos, dir);
            }
            var pos = safeMove(this);
            if (pos) this.attack_point = pos;
            Console.assert(this.attack_point);
            moveToPoint(this, this.attack_point);
            break;
        }
    }

    this.owner.shoot = false;
    switch (this.state_head)
    {
        case Aibot.STATE_HEAD_STAY:
            break;
        case Aibot.STATE_HEAD_FRONT:
        {
            var pos = Vector.add(this.owner.dynent.pos, this.owner.direction);
            angleTo(this, pos, 0.75);
            break;
        }
        case Aibot.STATE_HEAD_WAYPOINT:
        {
            var pos = this.waypoint_next ? this.waypoint_next.pos : this.waypoint_master.pos;
            angleTo(this, pos);
            break;
        }
        case Aibot.STATE_HEAD_SMOOTH_WAYPOINT:
        {
            var pos = this.waypoint_next ? this.waypoint_next.pos : this.waypoint_master.pos;
            var delta = angleTo(this, pos, 0.75);
            if (Math.abs(delta) < Math.PI / 6)
                this.state_head = Aibot.STATE_HEAD_WAYPOINT;
            break;
        }
        case Aibot.STATE_HEAD_POINT:
        {
            angleTo(this, this.point_head, 0.75);
            break;
        }
        case Aibot.STATE_HEAD_SHOOTED:
        {
            var delta = angleTo(this, this.point_head);
            if (Math.abs(delta) < Math.PI / 12)
            {
                if (this.waypoint_next || this.waypoint_master)
                    this.state_head = Aibot.STATE_HEAD_SMOOTH_WAYPOINT;
                else
                {
                    Console.error("Wyapoint == null");
                    this.state_head = Aibot.STATE_HEAD_FRONT;
                }
            }
            break;
        }
        case Aibot.STATE_HEAD_BOT:
        {
            var my_pos = this.owner.dynent.pos;
            var delta = Date.now() - this.bot_point.time;
            var bot_speed = Vector.mul(this.bot_point.vel, delta);
            var bot_pos = Vector.add(this.bot_point.pos, bot_speed);

            if (this.owner.weapon.type >= WEAPON.PLASMA)
            {
                var t = calcDirection(my_pos, bot_pos, this.bot_point.vel, WEAPON.wea_tabl[this.owner.weapon.type].vel);
                var new_bot_pos = Vector.add(bot_pos, Vector.mul(this.bot_point.vel, t));
                if (AI.isVisible(new_bot_pos, bot_pos, 1.5))
                    bot_pos = new_bot_pos;
            }

            var delta_angle = angleTo(this, bot_pos, this.angle_speed * 3);
            var need_shoot = false;
            if (this.owner.weapon.type === WEAPON.SHAFT)
            {
                need_shoot = delta_angle > -0.32 && delta_angle < 0.22;
            }
            else
            {
                var my_dir = new Vector(Math.sin(this.owner.dynent.angle), 
                                        Math.cos(this.owner.dynent.angle));
                var dir_to_bot = Vector.sub(bot_pos, my_pos);
                var binorm = Vector.normalize(dir_to_bot).binormalize();
                var rast = binorm.dot(my_dir) * dir_to_bot.length();

                var bullet_table =
                [
                    {left: -0.8, right: 0.4},
                    {left: -1.5, right: 1},
                    {left: -0.8, right: 0.4},
                    {left: -0.88, right: 0.37},
                    {left: -1.3, right: 0.7},
                    {left: -1.3, right: 0.7},
                ];

                var bullet_table_elem = bullet_table[this.owner.weapon.type];
                need_shoot = rast > bullet_table_elem.left && rast < bullet_table_elem.right;
                if (this.owner.weapon.type === WEAPON.ROCKET && dir_to_bot.length() < WEAPON.RADIUS_ROCKET)
                {
                    chooseWeapon(this, -1);
                    need_shoot = true;
                }
            }

            if (need_shoot)
            {
                this.owner.shoot = AI.botVisible(this.owner.dynent.pos, [bot_pos.x, bot_pos.y]);
            }
            break;
        }
    }
};

//think
Aibot.STATE_AFTER_RESPAWN = 0;
Aibot.STATE_FIND_MASTER = 1;
Aibot.STATE_CHECK_NEXT = 2;
Aibot.STATE_CHECK_OBJECT = 3;

//movement
Aibot.STATE_MOVE_STAY = 0;
Aibot.STATE_MOVE_TO_MASTER = 1;
Aibot.STATE_MOVE_TO_POINT = 2;
Aibot.STATE_MOVE_TO_POINT_SAFE = 3;
Aibot.STATE_MOVE_GRADIENT = 4;
Aibot.STATE_ATTACK = 5;

//head
Aibot.STATE_HEAD_STAY = 0;
Aibot.STATE_HEAD_FRONT = 1;
Aibot.STATE_HEAD_WAYPOINT = 2;
Aibot.STATE_HEAD_SMOOTH_WAYPOINT = 3;
Aibot.STATE_HEAD_POINT = 4;
Aibot.STATE_HEAD_SHOOTED = 5;
Aibot.STATE_HEAD_BOT = 6;

exports.Aibot = Aibot;