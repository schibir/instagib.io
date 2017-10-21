"use strict";

var Console = require("libs/log")(module);
var LevelGeneration = require("./gener").LevelGeneration;
var AI = require("./ai").AI;
var Vector = require("../libs/vector").Vector;
var Random = require("../libs/utility").Random;
var Dynent = require("../objects/dynent").Dynent;

function Level(size_class, seed)
{
    this.getItemPos = function()
    {
        return itemPos;
    }
    this.getLevelGener = function()
    {
        return level;
    }
    this.getAI = function()
    {
        return ai;
    };
    this.getRandomPos = function(rand)
    {
        var random_generator = rand ? rand.next : Math.random;
        while (true)
        {
            var x = my_board_width + random_generator() * (level.getSize() - my_board_width - 1) | 0;
            var y = my_board_width + random_generator() * (level.getSize() - my_board_width - 1) | 0;
            var pos = new Vector(x, y);
            if (!this.collideMap(pos, 50) && !this.collideLava(pos, 50))
                return pos;
        }
    };
    this.getMaxBots = function()
    {
        // calc count players. One player for 16x16 square
        var square = 0;
        level.getObstructionMap().for_each(function(val)
        {
            if (val < 0.5) square++;
            return val;
        });
        var count_player = square / (16 * 16) | 0;
        Console.debug("Count players for this level = ", count_player);
        return count_player;
    };
    
    //collide
    //for bot min val == 80
    //for bullet near 80
    //pos - Vector
    this.getCollide = function(pos, lava)
    {
        function frac(x)
        {
            return x - (x | 0);
        }
        function lerp(a, b, t)
        {
            return a * (1 - t) + b * t;
        }
        var buffer = lava ? level.getRiverMap() : level.getGroundMap();
        const koef = buffer.getSize() / my_size;
        var x = (pos.x - 0.25) * koef;
        var y = (pos.y - 0.25) * koef;
        var cx = x | 0;
        var cy = y | 0;
        if (cx < 0) return 0;
        if (cy < 0) return 0;
        if (cx > buffer.getSize() - 1) return 0;
        if (cy > buffer.getSize() - 1) return 0;
         
        var t00 = buffer.getData(cx,     cy);
        var t10 = buffer.getData(cx + 1, cy);
        var t01 = buffer.getData(cx,     cy + 1);
        var t11 = buffer.getData(cx + 1, cy + 1);
        var dx = frac(x);
        var dy = frac(y);
        var xx1 = lerp(t00, t10, dx);
        var xx2 = lerp(t01, t11, dx);
        var yy = lerp(xx1, xx2, dy);
        return yy * 255 | 0;
    };
    
    //dest_n -- Vector
    //pos -- Vector
    this.getNorm = function(dest_n, pos, lava = false)
    {
        Console.assert(dest_n);
        var t00 = this.getCollide(pos, lava);
        var t10 = this.getCollide(new Vector(pos.x + 0.25, pos.y), lava);
        var t01 = this.getCollide(new Vector(pos.x,        pos.y + 0.25), lava);
        dest_n.set(t10 - t00, t01 - t00);
        return t00;
    };

    //pos --  Vector
    this.getCollideBridges = function(pos)
    {
        var bridges = level.getBridges().getBridges();
        for (var i = 0; i < bridges.length; i++)
        {
            var bridge = bridges[i];
            var dist = Vector.sub(pos, bridge.pos);

            var cosa = Math.cos(bridge.angle);
            var sina = Math.sin(bridge.angle);

            var x = dist.x * cosa - dist.y * sina;
            var y = dist.x * sina + dist.y * cosa;

            if (Math.abs(x) < (bridge.size.x * 0.5 + 0.3) && Math.abs(y) < (bridge.size.y * 0.5 + 0.3))
                return { bridge: bridge, pos: new Vector(x, y) };
        }
        return null;
    };

    //collide map
    //pos - Vector
    //return Vector
    this.collideMap = function(pos, factor = 80)
    {
        var dir = new Vector(0, 0);
        var tile = this.getNorm(dir, pos);
        return tile > factor ? dir : null;
    };

    //collide_lava
    //pos - Vector
    this.collideLava = function(pos, factor = 160)
    {
        var tile = this.getCollide(pos, true);
        return tile > factor;
    };

    //pos -- Vector
    this.getSafetyDir = function(pos)
    {
        function getHeight(buffer)
        {
            const koef = buffer.getSize() / my_size;
            var x = (pos.x - 0.25) * koef;
            var y = (pos.y - 0.25) * koef;
            var cx = x | 0;
            var cy = y | 0;
            if (cx < 0) return 0;
            if (cy < 0) return 0;
            if (cx > buffer.getSize() - 1) return 0;
            if (cy > buffer.getSize() - 1) return 0;
            return buffer.getData(cx, cy) * 255 | 0;
        }

        var ground = getHeight(level.getGroundMap());
        if (ground > 30) ground = this.getCollide(pos, false);
        if (ground > 30)
        {
            var norm = new Vector(0, 0);
            this.getNorm(norm, pos, false);
            return norm.normalize();
        }

        var lava = getHeight(level.getRiverMap());
        if (lava > 30) lava = this.getCollide(pos, true);
        if (lava > 30)
        {
            //bridges
            var collide_bridge = this.getCollideBridges(pos);
            if (collide_bridge)
            {
                var bridge = collide_bridge.bridge;
                var bridge_pos = collide_bridge.pos;
                var norm = new Vector(0, 0);
                if (bridge_pos.x > bridge.size.x * 0.5 - 0.3) norm.add2(-1, 0);
                if (bridge_pos.x < -bridge.size.x * 0.5 + 0.3) norm.add2(1, 0);
                if (bridge_pos.y > bridge.size.y * 0.5 - 0.3) norm.add2(0, -1);
                if (bridge_pos.y < -bridge.size.y * 0.5 + 0.3) norm.add2(0, 1);
                var len = norm.length2();
                norm.normalize().rotate(bridge.angle);
                return len < 0.5 ? null : norm;
            }
            var norm = new Vector(0, 0);
            this.getNorm(norm, pos, true);
            return norm.normalize();
        }
        return null;
    };

    function generItemPos(level)
    {
        var count = level.getMaxBots();
        var item_pos = new Array(count);
        var rand = new Random(my_seed);

        for (var i = 0; i < count; i++)
        {
            var pos = level.getRandomPos(rand);
            item_pos[i] = new Dynent(pos, [2, 2]);
        }
        return item_pos;
    }

    const my_size_class = size_class;    // 0 - 64, 1 - 128, 2 - 256
    const my_board_width = 5;
    const my_seed = seed;//(Date.now() * Math.random()) & 0xffffffff;

    Console.debug("My seed = ", my_seed);
    var level = new LevelGeneration(my_size_class, my_board_width, my_seed);
    var my_size = level.getSize();

    //AI
    var ai = new AI(this);
    var itemPos = generItemPos(this);
}

exports.Level = Level;
