"use strict";

//main objects
var canvas;
var gl;
var text;
var gameClient;
var sun_direction = new Vector(-0.25, -0.5);

//input objects
var input =
{
    mouse_angle: 0,
    mouse_down:  false,
    mouse_wheel: 0, 
    keys: new Array(256),
};

var VK_A = function()
{
    return input.keys['A'.charCodeAt(0)] || input.keys[0x25];
};
var VK_W = function()
{
    return input.keys['W'.charCodeAt(0)] || input.keys[0x26];
};
var VK_S = function()
{
    return input.keys['S'.charCodeAt(0)] || input.keys[0x28];
};
var VK_D = function()
{
    return input.keys['D'.charCodeAt(0)] || input.keys[0x27];
};

//=============
var options =
{
    sens : 0.1,
    highQuality: true,
};

var stats = 
{
    count_kadr: 0,
    count_dynent_rendering: 0,
    count_decal: 0,
    count_net_package: 0,
    memory_all_package: 0,
    fps: 0,
};

function getMouseAngle()
{
    var angle = (input.mouse_angle * options.sens) % 360;
    return normalizeAngle(-angle / 360.0 * (2 * Math.PI));
}

function getWidth()
{
    return (document.documentElement.clientWidth
        || document.body.clientWidth
        || window.innerWidth) - 50;
}

function getHeight()
{
    var height = 50;
    return (document.documentElement.clientHeight
        || document.body.clientHeight
        || window.innerHeight) - height - 50;
}

function glInit()
{
    canvas = document.getElementById("canvas");
    canvas.width = getWidth();
    canvas.height = getHeight();

    var webglAttributes =
    {
        alpha                   : false,
        antialias               : false,
        depth                   : false,
        premultipliedAlpha      : true,
        preserveDrawingBuffer   : true,
        stencil                 : false,
    };
    gl = canvas.getContext("webgl", webglAttributes) ||
         canvas.getContext("experimental-webgl", webglAttributes);
    if (!gl)
    {
        document.getElementById('viewport-frame').style.display = 'none';
        document.getElementById('webgl-error').style.display = 'block';
        return false;
    }
    
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    var vertices = 
    [
        -1.0, -1.0,
        1.0,  -1.0,
        -1.0,  1.0,
        1.0,   1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enableVertexAttribArray(0);
    return true;
}

// Set up event handling
function initEvents()
{
    document.addEventListener("keydown", function(event) 
    {
        Event.emit("keydown", event.key);
        if (!Console.show)
        {
            input.keys[event.keyCode] = true;
        }
        event.preventDefault();
    }, false);
    
    document.addEventListener("keyup", function(event) 
    {
        Event.emit("keyup", event.key);
        if (!Console.show)
        {
            input.keys[event.keyCode] = false;
        }
        event.preventDefault();
    }, false);
        
    canvas.addEventListener("click", function(event) 
    {
        canvas.requestPointerLock();
    }, false);
    
    // Mouse handling code
    // When the mouse is pressed it rotates the players view
    canvas.addEventListener("mouseup", function(event) 
    {
        input.mouse_down = false;
    }, false);

    canvas.addEventListener("mousedown", function(event) 
    {
        input.mouse_down = true;
    }, false);

    canvas.addEventListener("mousemove", function(event) 
    {
        if (event.movementX !== undefined)
            input.mouse_angle += event.movementX;
        else
            input.mouse_angle = event.pageX;
    }, false);
    
    var last_wheel = 0;
    var onWheel = function(e) 
    {
        if (Date.now() > last_wheel)
        {
            last_wheel = Date.now() + 60;
            e = e || window.event;
            var delta = e.deltaY || e.detail || e.wheelDelta;
            if (delta > 0) input.mouse_wheel++;
            else if (delta < 0) input.mouse_wheel--;
            Event.emit("mousewheel", delta);
            e.preventDefault();
        }
        return false;
    };

    if ("onwheel" in canvas)  // IE9+, FF17+
        canvas.addEventListener("wheel", onWheel, false);
    else if ("onmousewheel" in canvas) // устаревший вариант события
        canvas.addEventListener("mousewheel", onWheel, false);
    else    // 3.5 <= Firefox < 17, более старое событие DOMMouseScroll пропустим
        canvas.addEventListener("MozMousePixelScroll", onWheel, false);

    var onResize = function()
    {
        var devicePixelRatio = window.devicePixelRatio || 1;
        if (document.fullscreenEnabled) 
        {
            canvas.width = screen.width * devicePixelRatio;
            canvas.height = screen.height * devicePixelRatio;
        } 
        else 
        {
            canvas.width = getWidth() * devicePixelRatio;
            canvas.height = getHeight() * devicePixelRatio;
        }
        gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener("resize", onResize, false);
    document.onmousewheel = function(e) { e.preventDefault(); }
    
    document.addEventListener("fullscreenchange", function(e) 
    {
        if (document.fullscreenEnabled)
        {
            canvas.requestPointerLock(); // Attempt to lock the mouse automatically on fullscreen
        }
        onResize();
    }, false);
    
    var button = document.getElementById("fullscreenBtn");
    button.addEventListener("click", function()
    {
        canvas.requestFullScreen();
    }, false);

    document.getElementById("highQuality").onchange = function()
    {
        options.highQuality = this.checked;
    };

    document.getElementById("sens").onchange = function()
    {
        options.sens = this.value / 500;
    };

    document.getElementById("sounds").onchange = function()
    {
        Howler.mute(!this.checked);
    };
}

var g_frame_count = 0;
var g_seconds = Date.now();

function calc_fps()
{
    var now = Date.now();
    g_frame_count++;
    if (now > g_seconds)
    {
        g_seconds = now + 1000;
        stats.fps = g_frame_count;
        g_frame_count = 0;
    }
}

function textReady()
{
    return text && text.ready();
}

function contentReady()
{
    return textReady() &&
           Item.ready() &&
           Weapon.ready() &&
           HUD.ready() &&
           Bot.ready() &&
           Particle.ready();
}

function gameReady()
{
    return contentReady() &&
           gameClient && gameClient.ready();
}

function renderLoading()
{
    if (textReady())
    {
        text.render([0, 0], 2, "#rLoading...", 2, {center: true});
    }
    if (gameReady()) render();
    else requestAnimationFrame(renderLoading, null);
}

function render() 
{
    gameClient.render();

    calc_fps();
    stats.count_kadr++;
    requestAnimationFrame(render, null);
}

function main()
{
    function getQueryVariable()
    {
        var ret = {};
        var query = document.cookie.replace(/ /g,'').replace(/;/g,'&');
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++)
        {
            var pair = vars[i].split('=');
            var param = decodeURIComponent(pair[0]);
            var value = decodeURIComponent(pair[1]);
            Console.info(param, "=", value);
            ret[param] = value;
        }
        return ret;
    }

    if (glInit())
    {
        initEvents();
        Console.load();
        text = new Text();

        var param = getQueryVariable();
        if (!param.nick)
        {
            location.href = "/";
            return;
        }
        renderLoading();

        Sound.setup();
        Item.load();
        Weapon.load();
        HUD.load();
        Bot.load();
        Particle.load();

        function waitForReady()
        {
            if (contentReady()) gameClient = new GameClient(param);
            else setTimeout(waitForReady, 100);
        }

        waitForReady();
    }
}
document.addEventListener("DOMContentLoaded", main);