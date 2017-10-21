"use strict";

var Console = require("libs/log")(module);
var normalizeAngle = require("../libs/utility").normalizeAngle;
var WEAPON = require("./global").constants.WEAPON;
var ITEM = require("./global").constants.ITEM;
var EVENT = require("./global").constants.EVENT;

//commands
const CL_GET_LEVEL_PARAM = 1;
const CL_PING = 2;
const CL_ADD_USER = 3;
const CL_USER_INPUTS = 4;
const CL_CHANGE_CAMERA = 5;
const CL_GET_USER_NICKS = 6;
const CL_SPECTATOR = 7;

const SV_LEVEL_PARAM = 128;
const SV_PING = 129;
const SV_USER_ADDED = 130;
const SV_FRAME = 131;
const SV_USER_NICKS = 132;
const SV_SPECTATOR = 133;

const ALFABET = " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?-+\\/():;_|%=[]><  абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЧЦШЩЪЫЬЭЮЯ";

function setString(view, offset, str)
{
    function encode(str, i)
    {
        var ind = ALFABET.indexOf(str.charAt(i), 0);
        if (ind < 0) return encode('?');
        return ind;
    }

    var length = Math.min(str.length, 255);
    view.setUint8(offset, length);        offset++;
    for (var i = 0; i < length; i++)
    {
        view.setUint8(offset, encode(str, i)); offset++;
    }
    return offset;
}

function getString(view, offset)
{
    function decode(ch)
    {
        var res = '';
        res = ALFABET.charAt(ch);
        return res;
    }

    var str = "";
    var length = view.getUint8(offset);   offset++;
    for (var i = 0; i < length; i++)
    {
        var char = view.getUint8(offset); offset++;
        str += decode(char);
    }
    return { offset: offset, str: str };
}

function toFixed(float, koef = 256)
{
    return (float * koef) | 0;
}

function toFloat(fixed, koef = 256)
{
    return fixed / koef;
}

function ServerBot()
{
    this.id = 0;
    this.angle = 0;
    this.x = 0;
    this.y = 0;
    this.weapon = 0;
    this.alive = false;
    this.power = 0;
    this.shield = false;
    this.shoot = false;
    this.seria = 0;
    //for my bot
    this.life = 0;
    this.patrons = [1 << 5, 0, 0, 0, 0, 0];
    this.controlable = false;
    //stats
    this.i_am_death = 0;   //id my killer
    this.i_am_kill = 0;    //id who I kill
    this.i_am_multi = 0;   //1 - double, 2 - triple, 3 - multi
    this.i_am_killer = false;
    this.i_am_looser = false;
    this.i_am_sniper = false;
    this.i_am_avenger = false;
    this.i_am_quickkill = false;
    this.i_am_quickdeath = false;
    this.i_am_telefraging = false;
    this.i_am_telefraged = false;
    //rating
    this.frag = 0;
    this.scores = 1200;
    this.rank = 0;
}

function ServerItem()
{
    this.type = 0;
    this.x = 0;
    this.y = 0;
}

function TableRow()
{
    this.nick = "";
    this.scores = 0;
}

function setBot(view, offset, bot, isCamera, isControlable)
{
    view.setUint16(offset, bot.id); offset += 2;
    
    //set bot state: alive, shoot, power, weatype
    var state = bot.weapon.type;
    var power = bot.power ? bot.power - ITEM.QUAD + 1 : 0;
    state |= power << 3;
    if (bot.shoot) state |= 1 << 5;
    if (bot.alive) state |= 1 << 6;
    if (bot.shield) state |= 1 << 7;
    view.setUint8(offset, state); offset++;

    var seria = bot.stats.currentseria ? bot.stats.currentseria : -bot.stats.currentantiseria;
    seria += 128;
    if (seria < 0) seria = 0;
    if (seria > 255) seria = 255;
    view.setUint8(offset, seria); offset++;

    view.setUint16(offset, toFixed(bot.dynent.angle)); offset += 2;
    view.setUint16(offset, toFixed(bot.dynent.pos.x)); offset += 2;
    view.setUint16(offset, toFixed(bot.dynent.pos.y)); offset += 2;
    if (isCamera)
    {
        var life = (bot.health / 40) | 0;
        if (life < 0) life = 0;
        view.setUint8(offset, life); offset++;
        var weamask = 0;
        for (var i = WEAPON.SHAFT; i <= WEAPON.ROCKET; i++)
        {
            var alpha = bot.weapon.patrons[i] / WEAPON.wea_tabl[i].patrons;
            var mask = alpha * (1 << 5) | 0;
            if (mask > ((1 << 5) - 1)) mask = ((1 << 5) - 1);
            weamask |= mask;
            weamask <<= 5;
        }
        view.setUint32(offset, weamask); offset += 4;
        view.setUint8(offset, isControlable ? 1 : 0); offset++;
        //stats
        view.setUint16(offset, bot.stats.i_am_death); offset += 2;
        view.setUint16(offset, bot.stats.i_am_kill); offset += 2;
        view.setUint8(offset, bot.stats.i_am_multi); offset++;
        var statsmask = 0;
        if (bot.stats.i_am_killer)        statsmask |= 1 << 0;
        if (bot.stats.i_am_looser)        statsmask |= 1 << 1;
        if (bot.stats.i_am_sniper)        statsmask |= 1 << 2;
        if (bot.stats.i_am_avenger)       statsmask |= 1 << 3;
        if (bot.stats.i_am_quickkill)     statsmask |= 1 << 4;
        if (bot.stats.i_am_quickdeath)    statsmask |= 1 << 5;
        if (bot.stats.i_am_telefraging)   statsmask |= 1 << 6;
        if (bot.stats.i_am_telefraged)    statsmask |= 1 << 7;
        view.setUint8(offset, statsmask); offset++;
        //rating
        view.setInt16(offset, bot.stats.frag); offset += 2;
        view.setInt16(offset, bot.stats.scores | 0); offset += 2;
        view.setUint8(offset, bot.stats.rank); offset++;
    }
    return offset;
}

function getBot(view, offset, bot, isCamera)
{
    bot.id = view.getUint16(offset); offset += 2;

    //get bot state: alive, shoot, power, weatype
    var state = view.getUint8(offset); offset++;
    bot.weapon = state & 0x7;
    var power = ((state >> 3) & 0x3);
    bot.power = power ? power - 1 + ITEM.QUAD : 0;
    if (state & (1 << 5)) bot.shoot = true;
    if (state & (1 << 6)) bot.alive = true;
    if (state & (1 << 7)) bot.shield = true;

    var seria = view.getUint8(offset); offset++;
    bot.seria = seria - 128;

    bot.angle = toFloat(view.getUint16(offset)); offset += 2;
    bot.x = toFloat(view.getUint16(offset)); offset += 2;
    bot.y = toFloat(view.getUint16(offset)); offset += 2;
    if (isCamera)
    {
        bot.life = view.getUint8(offset); offset++;
        var weamask = view.getUint32(offset); offset += 4;
        for (var i = WEAPON.ROCKET; i >= WEAPON.SHAFT; i--)
        {
            weamask >>= 5;
            bot.patrons[i] = weamask & ((1 << 5) - 1);
        }
        bot.controlable = view.getUint8(offset); offset++;
        //stats
        bot.i_am_death = view.getUint16(offset); offset += 2;
        bot.i_am_kill = view.getUint16(offset); offset += 2;
        bot.i_am_multi = view.getUint8(offset); offset++;
        var statsmask = view.getUint8(offset); offset++;
        if (statsmask & (1 << 0)) bot.i_am_killer = true;
        if (statsmask & (1 << 1)) bot.i_am_looser = true;
        if (statsmask & (1 << 2)) bot.i_am_sniper = true;
        if (statsmask & (1 << 3)) bot.i_am_avenger = true;
        if (statsmask & (1 << 4)) bot.i_am_quickkill = true;
        if (statsmask & (1 << 5)) bot.i_am_quickdeath = true;
        if (statsmask & (1 << 6)) bot.i_am_telefraging = true;
        if (statsmask & (1 << 7)) bot.i_am_telefraged = true;
        //rating
        bot.frag = view.getInt16(offset); offset += 2;
        bot.scores = view.getInt16(offset); offset += 2;
        bot.rank = view.getUint8(offset); offset++;
    }
    return offset;
}

function setBots(view, offset, mybot, listbots, isControlable)
{
    offset = setBot(view, offset, mybot, true, isControlable);

    view.setUint8(offset, listbots.length); offset++;

    for (var i = 0; i < listbots.length; i++)
        offset = setBot(view, offset, listbots[i], false, false);
    return offset;
}

function setItem(view, offset, item)
{
    view.setUint8(offset, item.type); offset++;
    view.setUint16(offset, toFixed(item.dynent.pos.x)); offset += 2;
    view.setUint16(offset, toFixed(item.dynent.pos.y)); offset += 2;
    return offset;
}

function getItem(view, offset, item)
{
    item.type = view.getUint8(offset); offset++;
    item.x = toFloat(view.getUint16(offset)); offset += 2;
    item.y = toFloat(view.getUint16(offset)); offset += 2;
    return offset;
}

function setItems(view, offset, listitems)
{
    view.setUint8(offset, listitems.length); offset++;

    for (var i = 0; i < listitems.length; i++)
        offset = setItem(view, offset, listitems[i]);
    return offset;
}

function setEvent(view, offset, event)
{
    view.setUint8(offset, event.type); offset++;
    if (event.type === EVENT.BULLET_DEAD)
    {
        var bullet = event.arg1;
        view.setUint16(offset, bullet.id); offset += 2;
    }
    else
    {
        view.setUint16(offset, toFixed(event.pos.x)); offset += 2;
        view.setUint16(offset, toFixed(event.pos.y)); offset += 2;
        if (event.type === EVENT.PAIN || event.type === EVENT.BOT_DEAD)
        {
            view.setInt16(offset, toFixed(event.dir.x, 50 * 256)); offset += 2;
            view.setInt16(offset, toFixed(event.dir.y, 50 * 256)); offset += 2;
            view.setUint16(offset, event.arg1); offset += 2;
        }
        else if (event.type === EVENT.BULLET_RESPAWN)
        {
            var bullet = event.arg1;
            var val = bullet.type | (bullet.owner.power << 4) | (event.arg2 ? 0x08 : 0);
            view.setUint8(offset, val); offset++;
            view.setUint16(offset, bullet.id); offset += 2;
            view.setUint16(offset, toFixed(normalizeAngle(bullet.dynent.angle))); offset += 2;
        }
        else if (event.type === EVENT.LINE_SHOOT)
        {
            var bullet = event.arg1;
            var val = bullet.type | (bullet.owner.power << 4);
            view.setUint8(offset, val); offset++;
            view.setUint16(offset, toFixed(normalizeAngle(bullet.dynent.angle))); offset += 2;
            var size = bullet.dynent.size.y * 20 | 0; // size.y could not can be more 12
            if (size > 255) size = 255;
            view.setUint8(offset, size); offset++;
            view.setUint16(offset, toFixed(bullet.dest.x)); offset += 2;
            view.setUint16(offset, toFixed(bullet.dest.y)); offset += 2;
            if (bullet.type === WEAPON.SHAFT)
            {
                view.setUint16(offset, bullet.owner.id); offset += 2;
                view.setInt16(offset, toFixed(bullet.norm_dir.x)); offset += 2;
                view.setInt16(offset, toFixed(bullet.norm_dir.y)); offset += 2;
                view.setInt16(offset, toFixed(bullet.nap.x)); offset += 2;
                view.setInt16(offset, toFixed(bullet.nap.y)); offset += 2;
            }
        }
    }
    return offset;
}

function getEvent(view, offset, event)
{
    Console.assert(event instanceof GameEvent);
    event.type = view.getUint8(offset); offset++;
    if (event.type === EVENT.BULLET_DEAD)
    {
        event.bulletid = view.getUint16(offset); offset += 2;
    }
    else
    {
        event.pos.x = toFloat(view.getUint16(offset)); offset += 2;
        event.pos.y = toFloat(view.getUint16(offset)); offset += 2;
        if (event.type === EVENT.PAIN || event.type === EVENT.BOT_DEAD)
        {
            var dx = toFloat(view.getInt16(offset), 50 * 256); offset += 2;
            var dy = toFloat(view.getInt16(offset), 50 * 256); offset += 2;
            event.dir = new Vector(dx, dy);
            event.botid = view.getUint16(offset); offset += 2;
        }
        else if (event.type === EVENT.BULLET_RESPAWN)
        {
            var val = view.getUint8(offset); offset++;
            event.bullet_type = val & 0x7;
            event.power = (val >> 4) & 0xf;
            event.sound = val & 0x08;
            event.bulletid = view.getUint16(offset); offset += 2;
            event.angle = toFloat(view.getUint16(offset)); offset += 2;
        }
        else if (event.type === EVENT.LINE_SHOOT)
        {
            var val = view.getUint8(offset); offset++;
            event.bullet_type = val & 0xf;
            event.power = (val >> 4) & 0xf;
            event.angle = toFloat(view.getUint16(offset)); offset += 2;
            var size = view.getUint8(offset); offset++;
            event.size_y = size / 20;
            var destx = toFloat(view.getUint16(offset)); offset += 2;
            var desty = toFloat(view.getUint16(offset)); offset += 2;
            event.dest = new Vector(destx, desty);
            if (event.bullet_type === WEAPON.SHAFT)
            {
                event.ownerid = view.getUint16(offset); offset += 2;
                var normx = toFloat(view.getInt16(offset)); offset += 2;
                var normy = toFloat(view.getInt16(offset)); offset += 2;
                event.norm_dir = new Vector(normx, normy);
                var napx = toFloat(view.getInt16(offset)); offset += 2;
                var napy = toFloat(view.getInt16(offset)); offset += 2;
                event.nap = new Vector(napx, napy);
            }
        }
    }
    return offset;
}

function setEvents(view, offset, listevents)
{
    var count = Math.min(listevents.length, 255);
    view.setUint8(offset, count); offset++;
    for (var i = 0; i < count; i++)
    {
        offset = setEvent(view, offset, listevents[i]);
    }
    return offset;
}

function setRow(view, offset, bot)
{
    var color = "y";
    if (bot.isKiller()) color = "r";
    else if (bot.isLooser()) color = "G";
    offset = setString(view, offset, color + bot.nick);
    view.setUint16(offset, bot.stats.scores); offset += 2;
    return offset;
}

function getRow(view, offset, row)
{
    Console.assert(row instanceof TableRow);
    var { offset, str } = getString(view, offset);
    row.nick = str;
    row.scores = view.getUint16(offset); offset += 2;
    return offset;
}

function setTable(view, offset, table)
{
    var count = table ? Math.min(table.length, 10) : 0;
    view.setUint8(offset, count); offset++;
    for (var i = 0; i < count; i++)
    {
        offset = setRow(view, offset, table[i]);
    }
    return offset;
}

function setUserNicks(view, offset, ids, game)
{
    function getNickById(id)
    {
        for (var i = 0; i < game.bots.length; i++)
            if (game.bots[i].id === id)
                return game.bots[i].nick;
        return "unknown";
    }

    view.setUint8(offset, ids.length); offset++;
    ids.forEach(function(id)
    {
        view.setUint16(offset, id); offset += 2;
        offset = setString(view, offset, getNickById(id));
    });

    return offset;
}

function getUserNicks(view, offset)
{
    var ret = {};
    var count = view.getUint8(offset); offset++;
    for (var i = 0; i < count; i++)
    {
        var id = view.getUint16(offset); offset += 2;
        var { offset: new_offset, str } = getString(view, offset);
        offset = new_offset;
        ret[id] = str;
    }

    return { offset: offset, ids: ret };
}

function Transport(socket, game)
{
    //common
    var self = this;
    this.socket = socket;
    this.opened = false;

    //client needs
    var pingtime = 0;
    this.ping = 0;
    this.callbacks = [];
    this.unknown_nicks = new Set();
    
    //server needs
    this.bot = null;
    this.spectator = null;
    this.tableTime = 0;
    this.client_ping = 0;
    this.client_ping_count = 0;

    function onData(data)
    {
        var view = new DataView(data);
        var cmd = view.getUint8(0);
        switch (cmd)
        {
            //server
            case CL_GET_LEVEL_PARAM:
                var senddata = new ArrayBuffer(1 + 4 + 4);
                var sendview = new DataView(senddata);
                sendview.setUint8(0, SV_LEVEL_PARAM);
                sendview.setUint32(0 + 1, game.seed | 0);
                sendview.setUint32(0 + 1 + 4, game.size_class | 0);
                socket.send(senddata, { binary : true });
                break;
            case CL_PING:
                var client_ping = view.getUint32(1);
                self.client_ping += Math.min(100, client_ping);
                self.client_ping_count++;
                var senddata = new ArrayBuffer(1);
                var sendview = new DataView(senddata);
                sendview.setUint8(0, SV_PING);
                socket.send(senddata, { binary : true });
                break;
            case CL_ADD_USER:
                var { offset, str: nick } = getString(view, 1);
                game.addUser(self, nick);

                var senddata = new ArrayBuffer(1);
                var sendview = new DataView(senddata);
                sendview.setUint8(0, SV_USER_ADDED);
                socket.send(senddata, { binary : true });
                break;
            case CL_USER_INPUTS:
                var fixed_angle = view.getUint16(1);
                var keys = view.getUint8(3);
                var user_inputs =
                {
                    angle       : toFloat(fixed_angle),
                    up          : keys & 1,
                    right       : keys & 2,
                    down        : keys & 4,
                    left        : keys & 8,
                    mouse       : keys & 16,
                    wheelup     : keys & 32,
                    wheeldown   : keys & 64,
                };
                game.setUserInputs(self, user_inputs);
                break;
            case CL_CHANGE_CAMERA:
                var cmd = view.getUint8(1);
                game.changeCamera(self, cmd);
                break;
            case CL_GET_USER_NICKS:
                var size = view.getUint8(1);
                var offset = 2;
                var ids = [];
                for (var i = 0; i < size; i++)
                {
                    var id = view.getUint16(offset);
                    offset += 2;
                    ids.push(id);
                }
                //responce
                var senddata = new ArrayBuffer(1 + setUserNicks(moc_view, 0, ids, game));
                var sendview = new DataView(senddata);
                sendview.setUint8(0, SV_USER_NICKS);
                setUserNicks(sendview, 1, ids, game);
                socket.send(senddata, { binary : true });
                break;
            case CL_SPECTATOR:
                var { offset, str } = getString(view, 1);
                var err = game.spectator(self, str);
                //responce
                var senddata = new ArrayBuffer(1 + setString(moc_view, 0, err));
                var sendview = new DataView(senddata);
                sendview.setUint8(0, SV_SPECTATOR);
                setString(sendview, 1, err);
                socket.send(senddata, { binary : true });
                break;
            //client
            case SV_LEVEL_PARAM:
                var seed = view.getUint32(1);
                var size_class = view.getUint32(1 + 4);
                self.callbacks[SV_LEVEL_PARAM](seed, size_class);
                break;
            case SV_PING:
                self.ping = Date.now() - pingtime;
                break;
            case SV_USER_ADDED:
                if (self.callbacks[SV_USER_ADDED])
                    self.callbacks[SV_USER_ADDED]();
                break;
            case SV_FRAME:
                var offset = 1;
                var server_time = view.getUint32(offset);    offset += 4;
                var mybot = new ServerBot();
                offset = getBot(view, offset, mybot, true);

                var count_bots = view.getUint8(offset); offset++;
                var listbots = [];
                for (var i = 0; i < count_bots; i++)
                {
                    listbots[i] = new ServerBot();
                    offset = getBot(view, offset, listbots[i], false);
                }

                var count_items = view.getUint8(offset); offset++;
                var listitems = [];
                for (var i = 0; i < count_items; i++)
                {
                    listitems[i] = new ServerItem();
                    offset = getItem(view, offset, listitems[i]);
                }

                var count_events = view.getUint8(offset); offset++;
                var listevents = [];
                for (var i = 0; i < count_events; i++)
                {
                    listevents[i] = new GameEvent(0, [0, 0]);
                    offset = getEvent(view, offset, listevents[i]);
                }

                var count_rows = view.getUint8(offset); offset++;
                var table = [];
                for (var i = 0; i < count_rows; i++)
                {
                    table[i] = new TableRow();
                    offset = getRow(view, offset, table[i]);
                }

                game.addFrame(
                {
                    time: server_time,
                    mybot: mybot,
                    listbots: listbots,
                    listitems: listitems,
                    listevents: listevents,
                    table: table,
                });
                break;
            case SV_USER_NICKS:
                var { offset, ids } = getUserNicks(view, 1);
                game.setUserNicks(ids);
                self.unknown_nicks.clear();
                break;
            case SV_SPECTATOR:
                var { offset, str } = getString(view, 1);
                self.callbacks[SV_SPECTATOR](str);
                break;
            default:
                Console.error("Unknown command");
                break;
        }
    }

    if (game.disconnect !== undefined)
    {
        function toArrayBuffer(buffer) 
        {
            var ab = new ArrayBuffer(buffer.length);
            var view = new Uint8Array(ab);
            for (var i = 0; i < buffer.length; ++i)
                view[i] = buffer[i];
            return ab;
        }

        socket.on("message", function(data)
        {
            self.opened = true;
            onData(data instanceof ArrayBuffer ? data : toArrayBuffer(data));
        });
        socket.on("close", function()
        {
            game.disconnect(self);
            self.opened = false;
        });
        socket.on("error", function()
        {
            Console.error("Socket error");
        });
    }
    else
    {
        Console.assert(game instanceof GameClient);
        socket.onmessage = function(e)
        {
            stats.count_net_package++;
            stats.memory_all_package += e.data.byteLength;
            onData(e.data);
        };

        function getPing()
        {
            if (!self.socket)
                return;

            var data = new ArrayBuffer(5);
            var view = new DataView(data);
            view.setUint8(0, CL_PING);
            view.setUint32(1, self.ping);
            socket.send(data);
            var pingdelay = parseInt(Console.variable("pingdelay", "time for ping update", 1000));
            setTimeout(getPing, pingdelay);
            pingtime = Date.now();
        }
        getPing();

        function getNicks()
        {
            if (!self.socket)
                return;
            if (self.unknown_nicks.size > 0)
            {
                var data = new ArrayBuffer(1 + 1 + 2 * self.unknown_nicks.size);
                var view = new DataView(data);
                view.setUint8(0, CL_GET_USER_NICKS);
                var size = Math.min(self.unknown_nicks.size, 255);
                view.setUint8(1, size);
                var offset = 2;
                self.unknown_nicks.forEach(function(id)
                {
                    view.setUint16(offset, id);
                    offset += 2;
                });
                socket.send(data);
                Console.debug("Request for nicks", self.unknown_nicks.size);
            }
            var nickdelay = parseInt(Console.variable("nickdelay", "time for get nicks", 1000));
            setTimeout(getNicks, nickdelay);
        }
        getNicks();
    }
}

Transport.prototype.getLevelParam = function(callback)
{
    var data = new ArrayBuffer(1);
    var view = new DataView(data);
    view.setUint8(0, CL_GET_LEVEL_PARAM);
    this.socket.send(data);

    this.callbacks[SV_LEVEL_PARAM] = callback;
};

Transport.prototype.addUser = function(nick, callback)
{
    var data = new ArrayBuffer(1 + setString(moc_view, 0, nick));
    var view = new DataView(data);
    var offset = 0;
    view.setUint8(offset, CL_ADD_USER);         offset++;
    offset = setString(view, offset, nick);
    this.socket.send(data);

    this.callbacks[SV_USER_ADDED] = callback;
};

Transport.prototype.getPing = function()
{
    return this.ping;
};

Transport.prototype.sendUserInputs = function()
{
    var self = this;
    function sendInputs()
    {
        if (!self.socket)
            return;

        var angle = getMouseAngle();
        var fixed_angle = toFixed(angle);
        var keys = 0;
        if (VK_W()) keys |= 1;
        if (VK_D()) keys |= 2;
        if (VK_S()) keys |= 4;
        if (VK_A()) keys |= 8;
        if (input.mouse_down) keys |= 16;

        if (!self.old_wheel) self.old_wheel = input.mouse_wheel;
        var delta = input.mouse_wheel - self.old_wheel;
        self.old_wheel = input.mouse_wheel;
        if (delta > 0) keys |= 32;
        else if (delta < 0) keys |= 64;

        var data = new ArrayBuffer(1 + 2 + 1);
        var view = new DataView(data);
        view.setUint8(0, CL_USER_INPUTS);
        view.setUint16(1, fixed_angle);
        view.setUint8(3, keys);
        self.socket.send(data);
        var send_time = parseInt(Console.variable("send-user-input-time", "time for send user input", 33));
        setTimeout(sendInputs, send_time);
    }
    sendInputs();
};

var moc_view =
{
    setUint8 : function(offset, val) {},
    setUint16 : function(offset, val) {},
    setInt16 : function(offset, val) {},
    setUint32 : function(offset, val) {},
};

Transport.prototype.sendFrame = function(server_time, mybot, listbots, listitems, listevents, table)
{
    if (!this.opened)
        return;

    if (this.socket.readyState !== this.socket.OPEN)
    {
        Console.error("Socket status =", this.socket.readyState);
        return;
    }

    Console.assert(mybot);

    var length = 1 + 4;
    length += setBots(moc_view, 0, mybot, listbots, mybot === this.bot);
    length += setItems(moc_view, 0, listitems);
    length += setEvents(moc_view, 0, listevents);
    length += setTable(moc_view, 0, table);

    var data = new ArrayBuffer(length);
    var view = new DataView(data);

    var offset = 0;
    view.setUint8(offset, SV_FRAME);        offset++;
    view.setUint32(offset, server_time);    offset += 4;

    offset = setBots(view, offset, mybot, listbots, mybot === this.bot);
    offset = setItems(view, offset, listitems);
    offset = setEvents(view, offset, listevents);
    offset = setTable(view, offset, table);

    this.socket.send(data);
};

Transport.prototype.changeCamera = function(cmd, callback)
{
    if (typeof(cmd) === "number")
    {
        var data = new ArrayBuffer(2);
        var view = new DataView(data);
        view.setUint8(0, CL_CHANGE_CAMERA);
        view.setUint8(1, cmd);
        this.socket.send(data);
    }
    else
    {
        assert(typeof(cmd) === "string");
        var data = new ArrayBuffer(1 + setString(moc_view, 0, cmd));
        var view = new DataView(data);
        view.setUint8(0, CL_SPECTATOR);
        setString(view, 1, cmd);
        this.socket.send(data);
        this.callbacks[SV_SPECTATOR] = callback;
    }
};

Transport.prototype.getUserNicks = function(nick_ids)
{
    var self = this;
    nick_ids.forEach(function(id)
    {
        self.unknown_nicks.add(id);
    });
};

exports.Transport = Transport;