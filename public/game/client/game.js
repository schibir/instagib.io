"use strict";

function GameClient(param)
{
    var nick = decodeURI(param.nick);
    var local = param.local;
    var addr = param.addr;
    var self = this;

    var debugRender;
    var socket;
    var room;

    var allbots = [];
    var nicks = [];
    var mybot;
    
    var server_time = 0;
    var framebots = [];
    var frameitems = [];
    var frameevents = [];
    var table = [];

    if (local !== undefined && local === "true")
    {
        room = new Room(42, 2, "local");
        debugRender = new DebugRender(room.getGame());
        socket = new FakeSocketClient(addr, 1);
    }
    else
    {
        socket = new WebSocket("ws://" + addr);
    }

    socket.binaryType = "arraybuffer";

    var levelRender;
    var transport;

    socket.onopen = function()
    {
        transport = new Transport(socket, self);
        transport.getLevelParam(function(seed, size_class)
        {
            var level = room ? room.getGame().level : new Level(size_class, seed);
            levelRender = new LevelRender(level, size_class);

            transport.addUser(nick, function()
            {
                transport.sendUserInputs();
            });
        });
        if (debugRender) debugRender.transport = transport;
    };
    socket.onclose = function(e)
    {
        socket = null;
        transport.socket = null;
        transport = null;
        Console.error("Connection with server was lost");
    };
    socket.onerror = function(e)
    {
        Console.assert(false, "Сетевая ошибка " + e.message);
    };

    Console.addCommand("spectator", "spectator bot with nick", function(id)
    {
        if (transport)
        {
            transport.changeCamera(id, function(err)
            {
                if (err === "Ok") Console.info(err);
                else Console.error(err);
            });
        }
    });
    Console.addCommand("status", "status this session", function(id)
    {
        if (local !== undefined && local === "true") Console.debug("This is local game");
        else Console.debug("This is online game");
    });
    Console.addCommand("about", "about me", function(id)
    {
        Console.info("Hello, I am Sergey Chibiryaev - author instagib.io game");
    });
    Console.addCommand("trafik", "Average trafik (byte per package)", function()
    {
        Console.info(stats.memory_all_package / stats.count_net_package | 0);
    });

    this.getNickById = function(id)
    {
        var nick = nicks[id];
        if (nick)
        {
            var color = "#y";
            var bot = id === mybot.id ? mybot : allbots[id];
            if (bot)
            {
                if (bot.seria >= 5) color = "#r";
                else if (bot.seria <= -5) color = "#G";
            }

            function getPlace()
            {
                for (var i = 0; i < table.length; i++)
                    if (table[i].nick.slice(1) === nick)
                        return i;
                return -1;
            }

            const place = getPlace();
            if (place >= 0 && place < 3) color = "#C" + (place + 1) + color;

            return color + nick;
        }
        return "";
    }
    this.getBotById = function(id)
    {
        for (var i = 0; i < framebots.length; i++)
            if (framebots[i].id === id)
                return framebots[i];
        return null;
    };
    this.getLevelRender = function()
    {
        return levelRender;
    };
    this.getNicks = function()
    {
        return nicks;
    };
    this.setUserNicks = function(ids)
    {
        for (var id in ids)
        {
            nicks[id] = ids[id];
        }
    };
    this.addFrame = function(frame)
    {
        server_time = frame.time;
        if (!mybot || mybot.id !== frame.mybot.id)
        {
            mybot = new BotClient(frame.time, frame.mybot, true);
        }
        mybot.addFrame(frame.time, frame.mybot, true);

        framebots.splice(0, framebots.length);
        framebots.push(mybot);
        for (var i = 0; i < frame.listbots.length; i++)
        {
            var bot = frame.listbots[i];
            var id = bot.id;
            if (!allbots[id]) allbots[id] = new BotClient(frame.time, bot, false);
            else allbots[id].addFrame(frame.time, bot, false);

            framebots.push(allbots[id]);
        }
        frameitems = frame.listitems;
        frameevents = frame.listevents;
        if (frame.table.length > 0) table = frame.table;

        //request for nick
        var unknown_nicks = [];
        for (var i = 0; i < framebots.length; i++)
        {
            var id = framebots[i].id;
            if (!nicks[id]) unknown_nicks.push(id);
        }
        transport.getUserNicks(unknown_nicks);
        Event.emit("frame");
    };
    this.ready = function()
    {
        return levelRender && levelRender.ready() && mybot;
    };
    this.getCamera = function()
    {
        return mybot;
    };
    this.render = function()
    {
        function renderItems()
        {
            gl.enable(gl.BLEND);

            frameitems.forEach(function(item)
            {
                Item.render(mybot.dynent, item);
            });

            gl.disable(gl.BLEND);
        }
        function renderBots()
        {
            gl.enable(gl.BLEND);
            if (options.highQuality)
            {
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                
                framebots.forEach(function(bot) { bot.renderShadow(mybot.dynent); });
                
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            }

            framebots.forEach(function(bot) { bot.render(mybot.dynent); });

            gl.disable(gl.BLEND);
            
            framebots.forEach(function(bot) { bot.renderStats(mybot.dynent); });
        }
        function updateBots()
        {
            framebots.forEach(function(bot)
            {
                bot.update();
            });
        }
        function handleEvents()
        {
            frameevents.forEach((event) =>
            {
                switch (event.type)
                {
                    case EVENT.BOT_RESPAWN: return Event.emit("cl_botrespawn", event.pos);
                    case EVENT.PAIN: return Event.emit("cl_botpain", event.pos, event.dir, event.botid);
                    case EVENT.BOT_DEAD: return Event.emit("cl_botdead", event.pos, event.dir, event.botid);
                    case EVENT.TAKE_WEAPON: return Event.emit("cl_takeweapon", event.pos);
                    case EVENT.TAKE_HEALTH: return Event.emit("cl_takehealth", event.pos);
                    case EVENT.TAKE_SHIELD: return Event.emit("cl_takeshield", event.pos);
                    case EVENT.TAKE_POWER: return Event.emit("cl_takepower", event.pos);
                    case EVENT.ITEM_RESPAWN: return Event.emit("cl_itemrespawn", event.pos);
                    case EVENT.BULLET_DEAD: return BulletClient.remove(event.bulletid);
                    case EVENT.BULLET_RESPAWN: return BulletClient.create(event);
                    case EVENT.LINE_SHOOT: return BulletLine.create(server_time, event);
                }
            });
            frameevents.splice(0, frameevents.length);
        }

        stats.count_dynent_rendering = 0;

        updateBots();

        handleEvents();

        levelRender.render(mybot.dynent);

        Particle.render(mybot.dynent, 0);

        renderItems();

        renderBots();

        BulletClient.render(mybot.dynent);

        Particle.render(mybot.dynent, 1);
        Particle.render(mybot.dynent, 2);

        levelRender.renderMinimap(mybot.dynent);

        HUD.render(mybot, table);

        text.render([0.8, -0.9], 2, "#gFPS#{0.87}= #w" + stats.fps, 1);
        text.render([0.8, -0.95], 2, "#gPing#{0.87}= #w" + transport.getPing(), 1);
        Console.render();

        if (local !== undefined && local === "true")
        {
            debugRender.render(mybot);
        }
    };
}
