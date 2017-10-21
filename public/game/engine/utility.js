"use strict";

mat4.trans = function(out, vec)
{
    return mat4.translate(out, out, [vec[0], vec[1], 0, 0]);
};

mat4.scal = function(out, vec)
{
    return mat4.scale(out, out, [vec[0], vec[1], 1, 1]);
};

mat4.rotate = function(out, angle)
{
    return mat4.rotateZ(out, out, angle);
};

Buffer.loadImage = function(img, callback)
{
    var image = new Image();
    image.onload = function() 
    {
        assert(image.width === image.height);
        var size = image.width;

        var R = new Buffer(size);
        var G = new Buffer(size);
        var B = new Buffer(size);

        var cnv = document.createElement("canvas");
        cnv.width = size;
        cnv.height = size;
        var disp = cnv.getContext("2d");

        disp.drawImage(image, 0, 0);
        var data = disp.getImageData(0, 0, size, size).data;

        for (var i = 0; i < size * size; i++)
        {
            var r = data[4 * i + 0] / 255;
            var g = data[4 * i + 1] / 255;
            var b = data[4 * i + 2] / 255;
            R.setData(i, r);
            G.setData(i, g);
            B.setData(i, b);
        }

        callback(R, G, B);

        Console.info("Loaded image: " + img + " [" + image.width + ", " + image.height + "]");
    }
    image.onerror = function()
    {
        assert(false, "while loading image '" + img + "'.");
    }
    image.src = img;
};

Buffer.create_texture = function(R, G, B, A, param)
{
    assert(R.getSize() === G.getSize());
    assert(R.getSize() === B.getSize());
    assert(R.getSize() === A.getSize());
    
    var size = R.getSize();
    var data = new Uint8Array(size * size * 4);
    
    for (var i = 0; i < size * size; i++)
    {
        var r = R.getData(i);
        var g = G.getData(i);
        var b = B.getData(i);
        var a = A.getData(i);
        data[4 * i + 0] = r * 255;
        data[4 * i + 1] = g * 255;
        data[4 * i + 2] = b * 255;
        data[4 * i + 3] = a * 255;
    }

    var parameters = param || {};
    parameters.size = size;
    return new Texture(data, parameters);
};
