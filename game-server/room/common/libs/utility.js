"use strict";

// my random generate
function Random(seed)
{
    var holdrand = (seed || (Date.now() * Math.random())) & 0xffffffff;
    
    this.next = function()
    {
        holdrand = (holdrand * 214013 + 2531011) & 0xffffffff;
        var ret = (holdrand >> 16) & 0x7fff;
        return ret / 32767.0;
    }
}

function normalizeAngle(angle)
{
    var count = (angle / (2 * Math.PI)) | 0;
    angle = angle - count * 2 * Math.PI;
    if (angle < 0) angle = 2 * Math.PI + angle;
    return angle;
}

exports.Random = Random;
exports.normalizeAngle = normalizeAngle;