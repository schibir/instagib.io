"use strict";

var Console = require("libs/log")(module);

function Vector(arg1, arg2)
{
    if (arg1 instanceof Vector)
    {
        Console.assert(arg2 === undefined);
        this.x = arg1.x;
        this.y = arg1.y;
    }
    else if (typeof(arg1) === "object")
    {
        Console.assert(arg2 === undefined);
        this.x = arg1[0];
        this.y = arg1[1];
    }
    else
    {
        Console.assert(typeof(arg1) === "number");
        Console.assert(typeof(arg2) === "number");
        this.x = arg1;
        this.y = arg2;
    }
}

Vector.prototype.toVec = function()
{
    return [this.x, this.y];
};

Vector.prototype.set = function(x, y)
{
    this.x = x;
    this.y = y;
    return this;
};

Vector.prototype.copy = function(vec)
{
    this.x = vec.x;
    this.y = vec.y;
    return this;
};

Vector.prototype.add = function(vec)
{
    this.x += vec.x;
    this.y += vec.y;
    return this;
};

Vector.prototype.add2 = function(x, y)
{
    this.x += x;
    this.y += y;
    return this;
};

Vector.prototype.sub = function(vec)
{
    this.x -= vec.x;
    this.y -= vec.y;
    return this;
};

Vector.prototype.sub2 = function(x, y)
{
    this.x -= x;
    this.y -= y;
    return this;
};

Vector.prototype.mul = function(val)
{
    this.x *= val;
    this.y *= val;
    return this;
};

Vector.prototype.mul2 = function(x, y)
{
    this.x *= x;
    this.y *= y;
    return this;
};

Vector.add = function(a, b)
{
    var ret = new Vector(a);
    return ret.add(b);
};

Vector.add2 = function(a, x, y)
{
    var ret = new Vector(a);
    return ret.add2(x, y);
};

Vector.sub = function(a, b)
{
    var ret = new Vector(a);
    return ret.sub(b);
};

Vector.sub2 = function(a, x, y)
{
    var ret = new Vector(a);
    return ret.sub2(x, y);
};

Vector.mul = function(a, val)
{
    var ret = new Vector(a);
    return ret.mul(val);
};

Vector.prototype.dot = function(vec)
{
    return this.x * vec.x + this.y * vec.y;
};

Vector.prototype.length2 = function()
{
    return this.dot(this);
};

Vector.prototype.length = function()
{
    return Math.sqrt(this.length2());
};

Vector.prototype.rotate = function(angle)
{
    var cosa = Math.cos(angle);
    var sina = Math.sin(angle);

    var x = this.x * cosa - this.y * sina;
    var y = -this.x * sina - this.y * cosa;
    return this.set(x, y);
};

Vector.rotate = function(vec, angle)
{
    var ret = new Vector(vec);
    return ret.rotate(angle);
};

Vector.prototype.normalize = function()
{
    var len = this.length();
    if (len !== 0.0)
    {
        this.mul(1 / len);
    }
    return this;
};

Vector.normalize = function(vec)
{
    var ret = new Vector(vec);
    return ret.normalize();
};

Vector.prototype.binormalize = function()
{
    return this.set(this.y, -this.x);
};

Vector.binormalize = function(vec)
{
    var ret = new Vector(vec);
    return ret.binormalize();
};

Vector.prototype.angle = function()
{
    return Math.atan2(-this.y, this.x);
};

Vector.prototype.binormalize = function()
{
    return this.set(this.y, -this.x);
};

Vector.binormalize = function(vec)
{
    var ret = new Vector(vec);
    return ret.binormalize();
};

Vector.prototype.interpolate = function(from, to, koef)
{
    return this.copy(to).sub(from).mul(koef).add(from);
};

Vector.interpolate = function(from, to, koef)
{
    var ret = new Vector(0, 0);
    return ret.interpolate(from, to, koef);
};

exports.Vector = Vector;
