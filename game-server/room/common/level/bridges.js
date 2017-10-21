"use strict";

var Vector = require("../libs/vector").Vector;
var Dynent = require("../objects/dynent").Dynent;

function Bridges(river_tree, river_buf, size_map, board_width)
{
    var bridges = [];

    function create_bridge(prev, cur, next)
    {
        function get_width_of_river(pos, dir)
        {
            for (var step = 1; step < 8; step++)
            {
                var koef = river_buf.getSize() / size_map;
                var p = Vector.add(pos, Vector.mul(dir, step)).mul(koef);
                var river_val = river_buf.getData(p.x | 0, p.y | 0);
                if (river_val < 0.1)
                    return step;
            }
            return 0;
        }

        var ret = null;
        var padding = board_width + 5;
        if (cur.x > padding && cur.x < size_map - padding &&
            cur.y > padding && cur.y < size_map - padding)
        {
            var a = Vector.sub(prev, cur);
            var b = Vector.sub(next, cur);
            var bissectrice = Vector.add(a, b).mul(0.5);
            if (bissectrice.length() < 0.1)
                bissectrice = Vector.binormalize(a);
            var norm_biss = Vector.normalize(bissectrice);
            
            var w1 = get_width_of_river(cur, norm_biss);
            norm_biss.mul(-1);
            var w2 = get_width_of_river(cur, norm_biss);
            if (w1 > 0 && w2 > 0)
            {
                norm_biss.mul(-1);
                var left = Vector.add(cur, Vector.mul(norm_biss, w1));
                var half = Vector.mul(norm_biss, -(w1 + w2) * 0.5);
                var center = Vector.add(left, half);

                ret = new Dynent(center, [w1 + w2, 3], bissectrice.angle());
            }
        }
        return ret;
    }

    // generate bridges
    const MIN_DIST = 64;
    function generateBridges(river, length)
    {
        for (var i = 1; i < river.length - 1; i++)
        {
            var len = Vector.sub(river[i + 1].pos, river[i].pos).length();
            length += len;
            if (length > MIN_DIST)
            {
                var bridge = create_bridge(river[i - 1].pos, river[i].pos, river[i + 1].pos);
                if (bridge)
                {
                    length = 0;
                    bridges.push(bridge);
                }
            }
            if (river[i].next)
                generateBridges(river[i].next, length);
        }
    }

    generateBridges(river_tree, 0);
    
    this.getBridges = function()
    {
        return bridges;
    }
}

exports.Bridges = Bridges;