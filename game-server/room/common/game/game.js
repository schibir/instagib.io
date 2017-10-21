"use strict";

var Console = require("libs/log")(module);
var config = require("config");
var Level = require("../level/level").Level;
var Bot = require("../objects/bot").Bot;
var cameraCulling = require("../objects/dynent").cameraCulling;
var Vector = require("../libs/vector").Vector;
var updateItem = require("../objects/item").updateItem;
var Weapon = require("../objects/weapon").Weapon;
var itemForEach = require("../objects/item").itemForEach;
var NickGenerator = require("../libs/nickGenerator").NickGenerator;
var gameplay = require("./gameplay").gameplay;
var GameEvent = require("../objects/event.js").GameEvent;
var EVENT = require("./global.js").constants.EVENT;

function Game(size_class, seed)
{
    var self = this;
    this.bots = [];
    this.bullets = [];
    this.droped = [];
    this.clients = [];
    this.events = [];
    this.start_time = 0;
    var current_id = 0;
    var current_bullet_id = 0;
    var client_id_for_table = 0;
    this.seed = seed;
    this.size_class = size_class;
    this.level = new Level(size_class, seed);
    var nickGenerator = new NickGenerator(3);

    var max_players = this.level.getMaxBots();

    function createBot(nick, isBot)
    {
        current_id++;
        if (current_id > 0xffff) current_id = 1;
        var bot = new Bot(self, nick, current_id, isBot);
        return bot;
    }
    function addBot()
    {
        var nick_length = (3 + Math.random() * 5) | 0;
        var nick = nickGenerator.gener(nick_length);
        if (self.bots.length === 3) nick = "lyaguha";
        self.bots.push(createBot(nick, true));
        Console.debug("Added new bot", nick);
    }
    function removeBot(bot)
    {
        Console.debug("Remove bot", bot.nick);
        for (var i = 0; i < self.bots.length; i++)
            if (self.bots[i].id === bot.id)
                return self.bots.splice(i, 1);
        Console.error("Could not find bot", bot.nick);
    }
    function handleCountBots()
    {
        var count_for_create = max_players - self.bots.length;

        if (count_for_create > 0)
        {
            for (var i = 0; i < count_for_create; i++)
                addBot();
            return;
        }
        else
        {
            var count_for_remove = -count_for_create;
            for (var i = 0; i < self.bots.length && count_for_remove > 0;)
                if (!self.bots[i].alive && self.bots[i].ai)
                {
                    removeBot(self.bots[i]);
                    count_for_remove--;
                }
                else i++;
        }
    }
    function updateBot()
    {
        handleCountBots();
        self.bots.forEach(function(bot)
        {
            if (!bot.alive && Date.now() > bot.resp_time)
            {
                bot.respawn();
            }
            bot.update(Date.now());
        });
    }
    function isVisible(bot, dynent)
    {
        return !cameraCulling(bot.dynent, dynent.pos, dynent.size);
    }
    function isListenable(bot, pos)
    {
        var len = Vector.sub(bot.dynent.pos, pos).length2();
        return len < 12 * 12 * 2;
    }
    function sendFrameForClient(client, need_table)
    {
        if (!client.spectator)
            return;

        var listbots = [];
        for (var i = 0; i < self.bots.length; i++)
            if (self.bots[i] !== client.spectator && isVisible(client.spectator, self.bots[i].dynent))
                listbots.push(self.bots[i]);

        var listitems = [];
        itemForEach(self, function(item)
        {
            if (isVisible(client.spectator, item.dynent))
                listitems.push(item);
        });

        var listevents = [];
        for (var i = 0; i < self.events.length; i++)
        {
            var event = self.events[i];
            if (event.type === EVENT.BOT_RESPAWN ||
                event.type === EVENT.TAKE_WEAPON ||
                event.type === EVENT.TAKE_HEALTH ||
                event.type === EVENT.TAKE_SHIELD ||
                event.type === EVENT.TAKE_POWER ||
                event.type === EVENT.ITEM_RESPAWN)
            {
                if (isListenable(client.spectator, event.pos))
                    listevents.push(event);
            }
            else if (event.type === EVENT.PAIN)
            {
                if (isVisible(client.spectator, {pos: event.pos, size: new Vector(2, 2)}))
                    listevents.push(event);
            }
            else if (event.type === EVENT.LINE_SHOOT)
            {
                if (isVisible(client.spectator, event.arg1.dynent))
                    listevents.push(event);
            }
            else if (event.type === EVENT.BOT_DEAD ||
                    event.type === EVENT.BULLET_RESPAWN ||
                    event.type === EVENT.BULLET_DEAD)
            {
                listevents.push(event);
            }
        }

        var table;
        if (need_table)
        {
            table = gameplay.sortBots(self.bots);
            client.tableTime = Date.now() + 1000;
        }

        client.sendFrame(Date.now() - self.start_time, client.spectator, listbots, listitems, listevents, table);
    }
    function sendFrame()
    {
        for (var i = 0; i < self.clients.length; i++)
        {
            var need_table = client_id_for_table === i;
            if (need_table) need_table = self.clients[i].tableTime < Date.now();
            sendFrameForClient(self.clients[i], need_table);
        }
        client_id_for_table++;
        if (client_id_for_table > self.clients.length - 1) client_id_for_table = 0;
    }

    var time_when_no_clients = 0;
    function handleForDrop()
    {
        if (self.clients.length === 0)
        {
            const timeout = config.get("game-server:timeout-for-destroy-room");
            if (time_when_no_clients === 0) time_when_no_clients = Date.now();
            else if (Date.now() > time_when_no_clients + timeout) self.onclose();
        }
        else time_when_no_clients = 0;
    }

    var frame_time = 0;
    var timer_id;
    var update_time = parseInt(config.get("game-server:update-time"));
    function update()
    {
        var start = Date.now();

        //clear
        self.bots.forEach(function(bot)
        {
            bot.stats.clear();
        });
        self.events.splice(0, self.events.length);

        //logic
        Weapon.update(self);
        updateBot(self);
        updateItem(self);

        sendFrame();

        handleForDrop();

        var end = Date.now();
        frame_time = end - start;
        var next_frame = update_time - frame_time;
        if (next_frame < 0) next_frame = 0;
        timer_id = setTimeout(update, next_frame);
    }

    this.countEmptySlots = function()
    {
        var count_users = 0;
        for (var i = 0; i < this.clients.length; i++)
            if (this.clients[i].bot)
                count_users++;

        return Math.max(0, max_players - count_users);
    };
    this.getFrameTime = function()
    {
        return frame_time;
    };
    this.getBulletId = function()
    {
        current_bullet_id++;
        if (current_bullet_id > 0xffff) current_bullet_id = 1;
        return current_bullet_id;
    };
    this.start = function()
    {
        this.start_time = Date.now();
        update();
    };
    this.stop = function()
    {
        if (timer_id)
        {
            clearTimeout(timer_id);
            timer_id = null;
        }
    };
    this.addUser = function(client, nick)
    {
        Console.debug("Add user", nick)
        var bot = createBot(nick, false);
        client.bot = bot;
        client.spectator = bot;
        this.bots.push(bot);
    };
    this.disconnect = function(client)
    {
        for (var i = 0; i < this.clients.length; i++)
        {
            if (this.clients[i] === client)
            {
                var nick = client.bot ? client.bot.nick : "";
                var stats = "";
                if (client.bot)
                {
                    stats = client.bot.stats.toString();
                    removeBot(client.bot);
                }
                Console.html("User disconnect <font color='red'>" + nick +
                             "</font>, avg ping = " + (client.client_ping / client.client_ping_count | 0) + " stats:" + stats);
                this.clients.splice(i, 1);
                Console.debug("Client disconnected:", nick);
                return;
            }
        }
        Console.error("Unknown client");
    };
    this.setUserInputs = function(client, user_inputs)
    {
        var bot = client.bot;
        if (bot.dynent) bot.dynent.angle = user_inputs.angle;
        bot.key_up = user_inputs.up;
        bot.key_left = user_inputs.left;
        bot.key_down = user_inputs.down;
        bot.key_right = user_inputs.right;
        bot.shoot = user_inputs.mouse;

        if (bot.weapon)
        {
            if (user_inputs.wheelup) bot.weapon.next();
            else if (user_inputs.wheeldown) bot.weapon.prev();
        }
    };
    this.changeCamera = function(client, cmd)
    {
        var bot = client.spectator;
        var index = -1;
        for (var i = 0; i < this.bots.length; i++)
        {
            if (this.bots[i] === bot)
            {
                index = i;
                break;
            }
        }
        if (index === -1)
        {
            Console.error("Don't find bot");
            return;
        }
        if (cmd === 1) index--;
        else if (cmd === 2) index++;
        else
        {
            Console.error("Unknown command for change camera");
            return;
        }
        if (index < 0) index = 0;
        if (index > this.bots.length - 1) index = this.bots.length - 1;
        client.spectator = this.bots[index];
    };
    this.spectator = function(client, nick)
    {
        for (var i = 0; i < this.bots.length; i++)
        {
            if (this.bots[i].nick === nick)
            {
                client.spectator = this.bots[i];
                return "Ok";
            }
        }
        return "Bot " + nick + " not found";
    };
    this.onclose = function()
    {
        log.assert("Please override this function");
    }
}

exports.Game = Game;