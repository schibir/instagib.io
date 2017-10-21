"use strict";

var Console = require("libs/log")(module);
var Random = require("./utility").Random;
var Vector = require("./vector").Vector;

function Buffer(size, seed)
{
    var data = new Float32Array(size * size);
    data.fill(0.0);

    var self = this;

    var rand = new Random(seed);

    this.getData = function(x, y)
    {
        return y ? data[y * size + x | 0] : data[x];
    }
    this.setData = function(ind, val)
    {
        data[ind | 0] = val;
    }
    this.getSize = function()
    {
        return size;
    }
    this.perlin = function(start_freq, koef)
    {
        var time = Date.now();

        function extrem(freq, ampl)
        {
            function dispersion(rad)
            {
                return 2 * rad * rand.next() - rad;
            }

            var ret = new Array(freq * freq);
            for (var i = 0; i < freq * freq; i++)
            {
                ret[i] = dispersion(ampl);
            }
            return ret;
        }
        function cos_lerp(a, b, t)
        {
            var ft = t * Math.PI;
            var f = (1 - Math.cos(ft)) * 0.5;
            return a * (1 - f) + b * f; 
        }

        var ampl = 1;
        var freq = start_freq;

        do
        {
            var buf = extrem(freq, ampl);

            function buf_data(x, y)
            {
                return buf[y * freq + x | 0];
            }
            for (var j = 0; j < size; j++)
            {
                for (var i = 0; i < size; i++)
                {
                    var x = i * freq / size | 0;
                    var y = j * freq / size | 0;
                    var tx = i * freq / size - x;
                    var ty = j * freq / size - y;
                    var x1 = buf_data(x, y);
                    var old_x = x;
                    x++;
                    if (x > freq - 1) x = 0;
                    var x2 = buf_data(x, y);
                    var xx = cos_lerp(x1, x2, tx);

                    y++;
                    if (y > freq - 1) y = 0;
                    var y1 = buf_data(old_x, y);
                    var y2 = buf_data(x, y);
                    var yy = cos_lerp(y1, y2, tx);
                    var h = cos_lerp(xx, yy, ty);

                    data[size * j + i | 0] += h;
                }
            }
            freq *= 2;
            ampl *= koef;
        }
        while (freq < size);

        Console.info("Perlin noise = ", Date.now() - time);
        return self;
    }
    this.normalize = function(a, b)
    {
        var time = Date.now();
        var min = data[0];
        var max = data[0];
        for (var i = 1; i < size * size; i++)
        {
            if (data[i] > max) max = data[i];
            if (data[i] < min) min = data[i];
        }
        var k = (b - a) / (max - min);
        for (var i = 0; i < size * size; i++)
            data[i] = (data[i] - min) * k + a;

        Console.info("Normalize = ", Date.now() - time);
        return self;
    }
    this.for_each = function(fun)
    {
        var time = Date.now();
        for (var j = 0; j < size; j++)
        {
            for (var i = 0; i < size; i++)
            {
                data[j * size + i | 0] = fun(self.getData(i, j), i, j);
            }
        }
        Console.info("For each = ", Date.now() - time);
        return self;
    }
    this.for_buf = function(buf, fun)
    {
        var time = Date.now();
        Console.assert(size === buf.getSize(), "Sizes of buffers must be equal");
        for (var j = 0; j < size; j++)
        {
            for (var i = 0; i < size; i++)
            {
                data[j * size + i | 0] = fun(self.getData(i, j), buf.getData(i, j), i, j);
            }
        }
        Console.info("For buffer = ", Date.now() - time);
        return self;
    }
    this.clamp = function(a, b)
    {
        var time = Date.now();
        for (var i = 0; i < size * size; i++)
        {
            if (data[i] < a) data[i] = a;
            if (data[i] > b) data[i] = b;
        }
        Console.info("Clamp = ", Date.now() - time);
        return self;
    }
    this.gaussian_fast = function(radius, src_buf, dir, mask)
    {
        var time = Date.now();
        Console.assert(size === src_buf.getSize(), "Sizes of buffers must be equal");
        Console.assert(self !== src_buf, "Source buffer must does not be same with this");
        if (mask)
        {
            Console.assert(size === mask.getSize(), "Sizes of buffers must be equal");
            Console.assert(self !== mask, "Source buffer must does not be same with this");
        }

        function norm(x)
        {
            const a = 1 / (Math.sqrt(2 * Math.PI));
            const b = -x * x / 2;
            return a * Math.exp(b);
        }
        
        for (var j = 0; j < size; j++)
        {
            for (var i = 0; i < size; i++)
            {
                if (mask && mask.getData(i, j) < 0.5)
                    continue;

                var kol = 0.0;
                var sum = 0.0;
                for (var p = -radius; p <= radius; p++)
                {
                    var x = i + dir[0] * p;
                    var y = j + dir[1] * p;
                    if (y < 0) continue;
                    if (y >= size) break;
                    if (x < 0) continue;
                    if (x >= size) break;
                    
                    var sx = (x - i) / radius;
                    var sy = (y - j) / radius;
                    var r = Math.sqrt(sx * sx + sy * sy);
                    var koef = norm(r * 3);
                    kol += koef;
                    sum += koef * src_buf.getData(x, y);
                }
                var ind = i + j * size | 0;
                data[ind] = sum / kol;
            }
        }
        Console.info("Gaussian fast = ", Date.now() - time);
    }
    this.getGaussian = function(radius, mask)
    {
        var blur_x = new Buffer(size);
        var blur = new Buffer(size);
        blur_x.gaussian_fast(radius, self, [1, 0], mask);
        blur.gaussian_fast(radius, blur_x, [0, 1], mask);
        return blur;
    }
    /*
    1) Clearing quad 2x2 with chess pattern:
            0 1      1 0      0 0
            1 0  or  0 1  =>  0 0
    2) Clearing single wall:
            0         0
          0 1 0  => 0 0 0
            0         0
    */
    this.filter = function(val)
    {
        var time = Date.now();
        var iter_count = 0;
        do
        {
            var cleared = false;
            for (var j = 1; j < size - 1; j++)
            {
                for (var i = 1; i < size - 1; i++)
                {
                    var a00 = self.getData(i,     j) > 0.5;
                    var a10 = self.getData(i + 1, j) > 0.5;
                    var a01 = self.getData(i,     j + 1) > 0.5;
                    var a11 = self.getData(i + 1, j + 1) > 0.5;
                    if (a00 !== a10 && a00 === a11 && a10 === a01)
                    {
                        data[i +      j      * size | 0] = val;
                        data[i + 1 +  j      * size | 0] = val;
                        data[i +     (j + 1) * size | 0] = val;
                        data[i + 1 + (j + 1) * size | 0] = val;
                        cleared = true;
                    }

                    var a0_1 = self.getData(i,     j - 1) > 0.5;
                    var a_10 = self.getData(i - 1, j) > 0.5;
                    if (a00 && !a10 && !a01 && !a0_1 && !a_10)
                    {
                        data[i +      j      * size | 0] = 0;
                        cleared = true;
                    }
                }
            }
            iter_count++;
        }
        while (cleared && iter_count < 5);
        Console.debug("Iteration count for filtering = ", iter_count);
        Console.info("Filtering = ", Date.now() - time);
        return self;
    }
    this.fill_isolated_area = function()
    {
        var time = Date.now();
        var filled = new Array(size * size);
        for (var i = 0; i < size * size; i++)
            filled[i] = data[i] > 0.5 ? 255 : 0;

        function fill(id, coord_x, coord_y)
        {
            var coords =
            [
                { x : coord_x, y : coord_y },
            ];

            while (coords.length > 0)
            {
                var cur = coords.pop();
                var x = cur.x;
                var y = cur.y;
                if (x < 0 || x > size - 1) continue;
                if (y < 0 || y > size - 1) continue;
                if (filled[x + y * size] !== 0) continue;
                filled[x + y * size] = id;
                coords.push({ x : x    , y : y - 1 });
                coords.push({ x : x - 1, y : y     });
                coords.push({ x : x + 1, y : y     });
                coords.push({ x : x    , y : y + 1 });
            }
        }

        // Fill level
        var id = 0;
        var id_count = [];
        for (var j = 0; j < size; j++)
        {
            for (var i = 0; i < size; i++)
            {
                if (filled[i + j * size | 0] === 0)
                {
                    fill(++id, i, j);
                    id_count[id] = 0;
                }
            }
        }

        // calc count for each area
        for (var i = 0; i < size * size; i++)
        {
            var val = filled[i];
            if (val !== 255)
            {
                id_count[val]++;
            }
        }

        // find id of area with max count elem
        var index_with_max_count = 1;
        for (var i = 2; i < id_count.length; i++)
        {
            if (id_count[i] > id_count[index_with_max_count])
                index_with_max_count = i;
        }

        // fiil all elem with id is not index_with_max_count
        for (var i = 0; i < size * size; i++)
        {
            var val = filled[i];
            if (val !== 255 && val !== index_with_max_count)
                data[i] = 1;
        }

        Console.info("Fill isolated area = ", Date.now() - time);
        return self;
    }
    this.draw = function(src_image)
    {
        var time = Date.now();
        var koef = src_image.getSize() / size;
        for (var j = 0; j < size; j++)
        {
            var y = (j * koef) | 0;
            Console.assert(y < src_image.getSize());
            for (var i = 0; i < size; i++)
            {
                var x = (i * koef) | 0;
                Console.assert(x < src_image.getSize());
                var val = src_image.getData(x, y);
                data[i + j * size] = val;
            }
        }
        Console.info("Draw from src_buffer = ", Date.now() - time);
    }
    this.copy = function(src_image)
    {
        var time = Date.now();
        Console.assert(size === src_image.getSize(), "Sizes of buffers must be equal");
        Console.assert(self !== src_image, "Source buffer must does not be same with this");

        for (var i = 0;  i < size * size; i++)
            data[i] = src_image.getData(i);

        Console.info("Copy = ", Date.now() - time);
    }
    this.bresenham = function(x0, y0, x1, y1, val)
    {
        var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        var dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; 
        var err = (dx > dy ? dx : -dy) / 2;

        while (true)
        {
            if (x0 >= 0 && x0 < size &&
                y0 >= 0 && y0 < size)
            {
                data[x0 + y0 * size] = val;
            }
            if (x0 === x1 && y0 === y1) break;
            var e2 = err;
            if (e2 > -dx) { err -= dy; x0 += sx; }
            if (e2 < dy) { err += dx; y0 += sy; }
        }
    }
    this.generate_river = function(amplitude, count_river)
    {
        var time = Date.now();

        function line(a, b, val)
        {
            self.bresenham(a.x | 0, a.y | 0, b.x | 0, b.y | 0, val);
        }

        // 1) generation two vertex: begin and end of river
        var rnd = rand.next();
        var begin = { pos: new Vector(rnd * size, size - 1), next: null, };
        var end = { pos: new Vector((1 - rnd) * size, 0), next: null, };

        // 2) split algorithm
        var all_river = [];

        function split(a, b, out)
        {
            var dir = Vector.sub(b.pos, a.pos);
            var length = dir.length();
            if (length < 5)
                return;

            var c = { pos: null, next: null, };
            c.pos = Vector.add(a.pos, b.pos).mul(0.5);

            length = (rand.next() - 0.5) * amplitude * length;
            c.pos.add(dir.normalize().binormalize().mul(length));
            
            split(a, c, out);
            out.push(c);
            all_river.push(c);
            split(c, b, out);
        }

        var river = [begin];
        split(begin, end, river);
        river.push(end);

        function random_point()
        {
            var ret = {pos: null, next: null, };
            var a = rand.next() * size;
            var b = rand.next() < 0.5 ? 0 : size - 1;
            if (rand.next() < 0.5) ret.pos = new Vector(a, b);
            else ret.pos = new Vector(b, a);
            return ret;
        }

        for (var count = 0; count < count_river; count++)
        {
            var pivot_id = rand.next() * all_river.length | 0;
            var pivot = all_river[pivot_id];
            var point_begin = { pos: new Vector(pivot.pos), next: null, };
            var point_end = random_point();
            var sub_river = [point_begin];
            split(point_begin, point_end, sub_river);
            sub_river.push(point_end);
            pivot.next = sub_river;    
        }

        // raster_river
        function raster_river(riv, val)
        {
            for (var i = 0; i < riv.length - 1; i++)
            {
                line(riv[i].pos, riv[i + 1].pos, val);
                if (riv[i].next)
                    raster_river(riv[i].next, val * 0.5);
            }
        }

        raster_river(river, 1);

        Console.info("River generation = ", Date.now() - time);
        return river;
    }
    this.shadow = function(src_buf, sun, length)
    {
        var time = Date.now();
        Console.assert(size === src_buf.getSize(), "Sizes of buffers must be equal");
        Console.assert(self !== src_buf, "Source buffer must does not be same with this");

        length = length || 12;
        var dir = Vector.normalize(sun);
        
        for (var j = 0; j < size; j++)
        {
            for (var i = 0; i < size; i++)
            {
                var shadow_value = 0.0;
                var count = 0;
                var x0 = i;
                var y0 = j;
                for (var k = 0; k < length; k++)
                {
                    var x = x0 + dir.x * k;  //coord trace in levelmap
                    var y = y0 + dir.y * k;
                    if (x < 0 || y < 0 || x > size - 1 || y > size - 1)
                        continue;

                    var val = src_buf.getData(x | 0, y | 0);
                    shadow_value += val;
                    count++;
                }
                data[i + j * size] = count === 0 ? 0 : shadow_value / count;
            }
        }

        Console.info("Shadow = ", Date.now() - time);
        return self;
    }
}

exports.Buffer = Buffer;