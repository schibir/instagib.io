"use strict";

var Buffer = require("../libs/buffer").Buffer;
var Console = require("libs/log")(module);
var Vector = require("../libs/vector").Vector;

function Waypoint(pos, dist)
{
    this.pos = pos;
    this.dist = dist;
    this.next = [];
    this.deleting_edges = [];
}

Waypoint.prototype.del_next = function(next)
{
    for (var i = 0; i < this.next.length; i++)
    {
        if (this.next[i] === next)
        {
            this.next.splice(i, 1);
            break;
        }
    }
}

Waypoint.prototype.normalize = function()
{
    for (var i = 0; i < this.next.length - 1; i++)
    {
        for (var j = i + 1; j < this.next.length;)
        {
            if (this.next[i] === this.next[j])
                this.next.splice(j, 1);
            else
                j++;
        }
    }
}

Waypoint.prototype.isBridge = function()
{
    return this.isbridge !== undefined && this.isbridge === true;
}

function AI(generated_level)
{
    var time = Date.now();

    var obstruction_map = generated_level.getLevelGener().getObstructionMap();
    var raw_level = generated_level.getLevelGener().getRawLevel();
    var bridges = generated_level.getLevelGener().getBridges().getBridges();

    var distance_field = new Buffer(obstruction_map.getSize() * 2);
    var level = new Buffer(obstruction_map.getSize() * 2);
    level.draw(obstruction_map);
    distance_field.copy(level);

    const MAX_VALUE = 256;
    distance_field.normalize(0, MAX_VALUE).for_each(function(val, x, y)
    {
        if (x === 0 || x === distance_field.getSize() - 1 ||
            y === 0 || y === distance_field.getSize() - 1)
            return MAX_VALUE;
        else return val;
    });

    function distance_step_forward()
    {
        var size = level.getSize();
        const SQRT_2 = Math.sqrt(2);
        for (var j = 1; j < size - 1; j++)
        {
            for (var i = 1; i < size - 1; i++)
            {
                if (distance_field.getData(i, j) < MAX_VALUE - 0.5)
                {
                    var val00 = distance_field.getData(i - 1, j - 1) - SQRT_2;
                    var val10 = distance_field.getData(i    , j - 1) - 1;
                    var val20 = distance_field.getData(i + 1, j - 1) - SQRT_2;
                    var val01 = distance_field.getData(i - 1, j    ) - 1;
                    var val = Math.max(val00, val10, val20, val01);
                    distance_field.setData(i + j * size, val);
                }
            }
        }
    }
    function distance_step_backward()
    {
        var size = level.getSize();
        const SQRT_2 = Math.sqrt(2);
        for (var j = size - 1; j > 0; j--)
        {
            for (var i = size - 1; i > 0; i--)
            {
                var val = distance_field.getData(i, j);
                if (val < MAX_VALUE - 0.5)
                {
                    var val00 = distance_field.getData(i - 1, j + 1) - SQRT_2;
                    var val10 = distance_field.getData(i    , j + 1) - 1;
                    var val20 = distance_field.getData(i + 1, j + 1) - SQRT_2;
                    var val01 = distance_field.getData(i + 1, j    ) - 1;
                    var val = Math.max(val00, val10, val20, val01, val);
                    distance_field.setData(i + j * size, val);
                }
            }
        }
    }

    distance_step_forward();
    distance_step_backward();

    var gradient_x = new Buffer(level.getSize());
    var gradient_y = new Buffer(level.getSize());

    function calc_gradient()
    {
        var size = level.getSize();
        for (var j = 1; j < size - 1; j++)
        {
            for (var i = 1; i < size - 1; i++)
            {
                var val00 = distance_field.getData(i - 1, j - 1);
                var val10 = distance_field.getData(i    , j - 1);
                var val20 = distance_field.getData(i + 1, j - 1);
                var val01 = distance_field.getData(i - 1, j);
                var val11 = distance_field.getData(i    , j);
                var val21 = distance_field.getData(i + 1, j);
                var val02 = distance_field.getData(i - 1, j + 1);
                var val12 = distance_field.getData(i    , j + 1);
                var val22 = distance_field.getData(i + 1, j + 1);

                var dx = (val00 - val11) + (val01 - val11) + (val02 - val11) +
                         (val11 - val20) + (val11 - val21) + (val11 - val22);

                var dy = (val00 - val11) + (val10 - val11) + (val20 - val11) +
                         (val11 - val02) + (val11 - val12) + (val11 - val22);

                gradient_x.setData(i + j * size | 0, dx);
                gradient_y.setData(i + j * size | 0, dy);
            }
        }
    }

    calc_gradient();

    gradient_x.normalize(-1, 1);
    gradient_y.normalize(-1, 1);
    const POROG = 0.4;

    var waypoints = [];

    function insert_bridges()
    {
        bridges.forEach(function(bridge)
        {
            var center = Vector.mul(bridge.pos, 2);
            var length = bridge.size.x;
            var dir = new Vector(-Math.cos(bridge.angle) * length, Math.sin(bridge.angle) * length);
            var p1 = Vector.add(center, dir);
            var p2 = Vector.sub(center, dir);
            var way1 = new Waypoint(p1, MAX_VALUE);
            var way2 = new Waypoint(p2, MAX_VALUE);
            var way3 = new Waypoint(center, MAX_VALUE);
            way1.isbridge = true;
            way2.isbridge = true;
            way3.isbridge = true;
            way1.next.push(way3);
            way2.next.push(way3);
            way3.next.push(way1);
            way3.next.push(way2);
            waypoints.push(way1);
            waypoints.push(way2);
            waypoints.push(way3);
        });
    }
    function find_waypoints()
    {
        var size = level.getSize();
        for (var j = 1; j < size - 1; j++)
        {
            for (var i = 1; i < size - 1; i++)
            {
                var val = level.getData(i, j);
                if (val > 0.5)
                    continue;

                var valx00 = gradient_x.getData(i, j);
                var valy00 = gradient_y.getData(i, j);
                if (valx00 > -POROG && valx00 < POROG &&
                    valy00 > -POROG && valy00 < POROG)
                {
                    waypoints.push(new Waypoint(new Vector(i, j), MAX_VALUE - distance_field.getData(i, j)));
                }

                var valx10 = gradient_x.getData(i + 1, j);
                var valx01 = gradient_x.getData(i    , j + 1);
                var valx11 = gradient_x.getData(i + 1, j + 1);

                var valy10 = gradient_y.getData(i + 1, j);
                var valy01 = gradient_y.getData(i    , j + 1);
                var valy11 = gradient_y.getData(i + 1, j + 1);

                var valx = valx00 + valx10 + valx01 + valx11;
                var valy = valy00 + valy10 + valy01 + valy11;
                if (valx > -POROG && valx < POROG &&
                    valy > -POROG && valy < POROG)
                {
                    waypoints.push(new Waypoint(new Vector(i + 0.5, j + 0.5), MAX_VALUE - distance_field.getData(i, j)));
                }
            }
        }
        waypoints.sort(function(a, b)
        {
            return b.dist - a.dist;
        });
    }
    function calc_hash(size_ceil)
    {
        var hash = [];
        for (var i = 0; i < waypoints.length; i++)
        {
            var x = (waypoints[i].pos.x / size_ceil) | 0;
            var y = (waypoints[i].pos.y / size_ceil) | 0;
            var ind = x + level.getSize() * y;
            if (hash[ind] === undefined) hash[ind] = [];
            hash[ind].push(waypoints[i]);
        }
        return hash;
    }
    function hash_forEach(hash, waypoint, size_ceil, callback)
    {
        var x = (waypoint.pos.x / size_ceil) | 0;
        var y = (waypoint.pos.y / size_ceil) | 0;

        for (var xx = x - 1; xx <= x + 1; xx++)
        {
            for (var yy = y - 1; yy <= y + 1; yy++)
            {
                var ind = xx + yy * level.getSize();
                if (hash[ind])
                {
                    hash[ind].forEach(function(next)
                    {
                        if (next === waypoint)
                            return;

                        callback(next);
                    });
                }
            }
        }
    }
    function delete_waypoints()
    {
        for (var i = 0; i < waypoints.length;)
        {
            if (waypoints[i].del && waypoints[i].del === true)
            {
                waypoints[i].next.forEach(function(next)
                {
                    next.del_next(waypoints[i]);
                });
                waypoints.splice(i, 1);
            }
            else
                i++;
        }
    }
    function filter_nearest()
    {
        const MIN_DIST = 4;
        var hash = calc_hash(MIN_DIST);
        for (var i = 0; i < waypoints.length; i++)
        {
            var cur = waypoints[i];
            if (cur.del && cur.del === true)
                continue;
            if (cur.isBridge())
                continue;

            hash_forEach(hash, cur, MIN_DIST, function(next)
            {
                if (next.isBridge())
                    return;

                var dir = Vector.sub(cur.pos, next.pos);
                if (dir.length2() < MIN_DIST * MIN_DIST)
                {
                    next.del = true;
                }
            });
        }
        delete_waypoints();
    }
    const MAX_DIST = 10 * 2;
    function visible(a, b, buffer, max_val, max_dist)
    {
        var norm = Vector.sub(b, a);
        var len = norm.length();
        if (len > max_dist)
            return false;

        //tracing there
        norm.normalize();
        for (var step = 1; step < len; step++)
        {
            var vec = Vector.mul(norm, step);
            var pos = Vector.add(a, vec);
            var x = (pos.x + 0.5) | 0;
            var y = (pos.y + 0.5) | 0;
            if (buffer.getData(x, y) > max_val)
                return false;
        }
        return true;
    }
    function build_graph()
    {
        var hash = calc_hash(MAX_DIST);
        for (var i = 0; i < waypoints.length; i++)
        {
            var cur = waypoints[i];
            hash_forEach(hash, cur, MAX_DIST, function(next)
            {
                if (visible(cur.pos, next.pos, level, 0.5, MAX_DIST))
                {
                    cur.next.push(next);
                    next.next.push(cur);
                }
            });
        }

        for (var i = 0; i < waypoints.length; i++)
            waypoints[i].normalize();
    }
    function filter_triangle_pattern()
    {
        function equals(next1, next2)
        {
            var ret = [];
            for (var i = 0; i < next1.length; i++)
            {
                var n1 = next1[i];
                for (var j = 0; j < next2.length; j++)
                {
                    var n2 = next2[j];
                    if (n1 === n2)
                        ret.push(n1);
                }
            }
            return ret;
        }

        for (var i = 0; i < waypoints.length; i++)
        {
            var cur = waypoints[i];
            for (var ii = 0; ii < cur.next.length; ii++)
            {
                var next = cur.next[ii];
                var commons = equals(cur.next, next.next);
                for (var jj = 0; jj < commons.length; jj++)
                {
                    var common = commons[jj];
                    // triangle A - cur; B - next; C - common
                    var ABx = next.pos.x - cur.pos.x;
                    var ABy = next.pos.y - cur.pos.y;
                    var ACx = common.pos.x - cur.pos.x;
                    var ACy = common.pos.y - cur.pos.y;
                    var BCx = common.pos.x - next.pos.x;
                    var BCy = common.pos.y - next.pos.y;
                    var ab = ABx * ABx + ABy * ABy;
                    var ac = ACx * ACx + ACy * ACy;
                    var bc = BCx * BCx + BCy * BCy;

                    if (ab > ac && ab > bc)
                    {
                        cur.deleting_edges.push(next);
                    }
                    else if (ac > ab && ac > bc)
                    {
                        cur.deleting_edges.push(common);
                    }
                }
            }
        }
        for (var i = 0; i < waypoints.length; i++)
        {
            var cur = waypoints[i];
            cur.deleting_edges.forEach(function(del)
            {
                cur.del_next(del);
                del.del_next(cur);
            });
        }
    }
    function filter_pipirks()
    {
        for (var i = 0; i < waypoints.length; i++)
        {
            var cur = waypoints[i];
            if (cur.isBridge())
                continue;

            if (cur.next.length <= 1)
            {
                cur.del = true;
            }
        }
        delete_waypoints();
    }
    function div_coord()
    {
        for (var i = 0; i < waypoints.length; i++)
        {
            waypoints[i].pos.mul(0.5);
            waypoints[i].dist *= 0.5;
        }
    }

    insert_bridges();
    find_waypoints();
    Console.debug("Count waypoints = ", waypoints.length);
    filter_nearest();
    Console.debug("Count waypoints after filter nearest = ", waypoints.length);
    build_graph();
    filter_triangle_pattern();
    filter_pipirks();
    Console.debug("Count waypoints after filter pipirks = ", waypoints.length);
    div_coord();

    const WAYPOINT_VISIBLE_DIST = MAX_DIST / 2;
    AI.OBJECT_VISIBLE_DIST = WAYPOINT_VISIBLE_DIST * Math.sqrt(2);
    var hash_max_dist = calc_hash(WAYPOINT_VISIBLE_DIST);

    this.isVisible = function(my_pos, pos, val = 2.5, max_dist = WAYPOINT_VISIBLE_DIST)
    {
        var a = Vector.mul(my_pos, 2);
        var b = Vector.mul(pos, 2);
        return visible(a, b, distance_field, MAX_VALUE - val, max_dist * 2);
    }
    this.botVisible = function(my_pos, bot_pos)
    {
        return visible(my_pos, bot_pos, raw_level, 0.5, AI.OBJECT_VISIBLE_DIST);
    }
    this.getVisibleWaypoint = function(dynent)
    {
        var ret = [];
        var self = this;
        hash_forEach(hash_max_dist, dynent, WAYPOINT_VISIBLE_DIST, function(next)
        {
            if (self.isVisible(dynent.pos, next.pos, 0.5))
            {
                ret.push(next);
            }
        });
        return ret;
    }
    this.getGradient = function(my_pos)
    {
        var x = my_pos.x * 2 | 0;
        var y = my_pos.y * 2 | 0;
        if (level.getData(x, y) > 0.5) //lava
        {
            var bridge = generated_level.getCollideBridges(my_pos);
            if (bridge)
            {
                return new Vector(-Math.cos(bridge.bridge.angle), Math.sin(bridge.bridge.angle));
            }
            else
            {
                Console.error("Could not find bridge");
                return new Vector(1, 0);
            }
        }
        else
        {
            var grad_x = gradient_x.getData(x, y);
            var grad_y = gradient_y.getData(x, y);
            var vec = new Vector(grad_x, grad_y);
            return vec.normalize();
        }
    }
    
    Console.info("AI = ", Date.now() - time);
}

exports.AI = AI;