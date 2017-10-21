
"use strict";

function BotClient(server_time, serverBot, isCamera)
{
    this.id = serverBot.id;
    this.controlable = serverBot.controlable;
    var skinid = this.id % Bot.skinnames.length;
    this.skin = Bot.skinnames[skinid];
    this.old_frame_dynent = null;
    this.new_frame_dynent = new Dynent([serverBot.x, serverBot.y], [1, 1], serverBot.angle);
    this.old_frame_time = 0;
    this.new_frame_time = server_time;
    this.dynent = new Dynent([serverBot.x, serverBot.y], [1, 1], serverBot.angle);
    this.weapon = new WeaponClient(serverBot.weapon, serverBot.shoot);
    //animation
    this.begin_of_walk = 0;
    this.leg_angle = 0;
    this.key_up = false;
    this.key_right = false;
    this.key_down = false;
    this.key_left = false;

    this.addFrame(server_time, serverBot, isCamera);
}

BotClient.prototype.addFrame = function(server_time, serverBot, isCamera)
{
    assert(this.id === serverBot.id);
    this.old_frame_dynent = this.new_frame_dynent;
    this.new_frame_dynent = new Dynent([serverBot.x, serverBot.y], [1, 1], serverBot.angle);
    this.old_frame_time = this.new_frame_time;
    this.new_frame_time = server_time;
    this.my_time = Date.now();

    this.alive = serverBot.alive;
    this.power = serverBot.power;
    this.shield = serverBot.shield;
    this.weapon.setType(serverBot.weapon);
    if (serverBot.shoot) this.weapon.shoot();
    this.seria = serverBot.seria;

    this.life = serverBot.life;
    this.patrons = serverBot.patrons;

    if (isCamera)
    {
        if (serverBot.i_am_death) Event.emit("cl_death", this.id, serverBot.i_am_death);
        if (serverBot.i_am_kill && serverBot.i_am_kill !== this.id) Event.emit("cl_kill", serverBot.i_am_kill);
        if (serverBot.i_am_multi) Event.emit("cl_multi", serverBot.i_am_multi);
        if (serverBot.i_am_killer) Event.emit("cl_killer");
        if (serverBot.i_am_looser) Event.emit("cl_looser");
        if (serverBot.i_am_sniper) Event.emit("cl_sniper");
        if (serverBot.i_am_avenger) Event.emit("cl_avenger");
        if (serverBot.i_am_quickkill) Event.emit("cl_quickkill");
        if (serverBot.i_am_quickdeath) Event.emit("cl_quickdeath");
        if (serverBot.i_am_telefraging) Event.emit("cl_telefraging");
        if (serverBot.i_am_telefraged) Event.emit("cl_telefraged");
        this.frag = serverBot.frag;
        this.scores = serverBot.scores;
        this.rank = serverBot.rank;
    }

    var dir = Vector.sub(this.new_frame_dynent.pos, this.old_frame_dynent.pos);
    this.speed = dir.length() / (this.new_frame_time - this.old_frame_time);
    this.direction = dir.normalize().rotate(this.new_frame_dynent.angle);
    this.direction.y *= -1;
    //workaround
    this.direction.mul(100);
    this.direction.x = this.direction.x | 0;
    this.direction.y = this.direction.y | 0;
}

BotClient.prototype.update = function()
{
    var new_time = this.new_frame_time;
    var old_time = this.old_frame_time;
    var update_server_time = parseInt(config.get("game-server:update-time"));
    var current_time = new_time + (Date.now() - this.my_time) - update_server_time;
    var koef = new_time === old_time ? 0 : (current_time - old_time) / (new_time - old_time);
    if (koef < 0) koef = 0;
    
    this.dynent.interpolate(this.old_frame_dynent, this.new_frame_dynent, koef);

    if (this.controlable)
    {
        this.dynent.angle = getMouseAngle();
    }
    
    //animation
    function update_leg(self)
    {
        if (self.speed < Bot.SPEED * 0.5)
        {
            self.begin_of_walk = 0;
        }
        else if (self.begin_of_walk === 0)
        {
            self.begin_of_walk = Date.now();
        }
    }

    update_leg(this);
}

BotClient.prototype.renderShadow = function(camera)
{
    if (!this.alive)
        return;

    var pos = Vector.sub(this.dynent.pos, sun_direction);
    Dynent.render(camera, Bot.skins[this.skin].sh_body,
        Bot.shader_shadow, pos, [1.2, 1.2], this.dynent.angle);
    this.weapon.renderShadow(camera, this);
}

BotClient.prototype.render = function(camera)
{
    if (!this.alive)
        return;

    function renderLeg(self, val, dx)
    {
        var sina = Math.sin(self.dynent.angle);
        var cosa = Math.cos(self.dynent.angle);
        var ca = Math.cos(self.leg_angle);
        var sa = Math.sin(self.leg_angle);
        var x = Bot.skins[self.skin].x + dx;

        if (val < 0.5)
        {
            if (val > 0.25) val = 0.5 - val;
            var pos = Vector.add2(self.dynent.pos,
                cosa * (x - val * 2 * sa) - sina * (-0.3 + val * 2 * ca),
               -cosa * (-0.3 + val * 2 * ca) - sina * (x - val * 2 * sa));
            Dynent.render(camera, Bot.skins[self.skin].leg, Bot.shader_bot, pos, [1, val * 4], self.dynent.angle + self.leg_angle);
        }
        else
        {
            val -= 0.5;
            if (val > 0.25) val = 0.5 - val;
            var pos = Vector.add2(self.dynent.pos,
                cosa * (x + val * 2 * sa) + sina * (0.2 + val * 2 * ca),
                cosa * (0.2 + val * 2 * ca) - sina * (x + val * 2 * sa));
            Dynent.render(camera, Bot.skins[self.skin].legback, Bot.shader_bot, pos, [1, val * 4], self.dynent.angle + self.leg_angle);
        }
    }
    function haloRender(self)
    {
        if (self.power)
        {
            var color = [1, 0.5, 0.5, 0];
            if (self.power === ITEM.REGEN) color = [0.5, 1, 0.5, 0];
            else if (self.power === ITEM.SPEED) color = [0.5, 0.5, 1, 0];

            gl.blendFunc(gl.ONE, gl.ONE);

            Dynent.render(camera, Bot.skins[self.skin].sh_body, Bot.shader_halo,
                self.dynent.pos, [1.2, 1.2], self.dynent.angle,
            {
                vectors:
                [
                    { location: Bot.shader_halo.color, vec: color, },
                ],
            });

            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
    function shieldRender(self)
    {
        if (self.shield)
        {
            var color = [0.5, 0.5, 1, 0];
            gl.blendFunc(gl.ONE, gl.ONE);
            var state =
            {
                vectors:
                [
                    {
                        location: Weapon.shader_noshadow_color.color,
                        vec: color, 
                    },
                ],
            };
            Dynent.render(camera,
                          Bot.tex_shield,
                          Weapon.shader_noshadow_color,
                          self.dynent.pos,
                          [2, 2],
                          0, state);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
    function renderBody(self)
    {
        if (!cameraCulling(camera, self.dynent.pos, self.dynent.size))
        {
            var speed = self.power === ITEM.SPEED ? Bot.SPEED * 1.5 : Bot.SPEED;
            const period = 500 * Bot.SPEED / speed;
            var time = Date.now();
            var step = (time - self.begin_of_walk) / period;
            if (self.begin_of_walk === 0) step = 0;
            var val = step - (step | 0);    //from 0 to 1

            var angle = self.direction.angle() + Math.PI / 2;
            if (angle > Math.PI / 2) angle -= Math.PI;
            else if (angle < -Math.PI / 2) angle += Math.PI;
            self.leg_angle += (angle - self.leg_angle) * 0.2;
            
            //left leg
            renderLeg(self, val, 0);
            //right leg
            val += 0.5;
            if (val >= 1) val -= 1;
            renderLeg(self, val, 0.4);

            haloRender(self);
            self.dynent.render(camera, Bot.skins[self.skin].body, Bot.shader_bot);
            shieldRender(self);
        }
    }

    renderBody(this);
    this.weapon.render(camera, this);
}

BotClient.prototype.renderStats = function(camera)
{
    if (cameraCulling(camera, this.dynent.pos, this.dynent.size))
        return;
    
    var pos = Vector.sub(this.dynent.pos, camera.pos);
    var sina = Math.sin(camera.angle);
    var cosa = Math.cos(camera.angle);
    pos.set(cosa * pos.x - sina * pos.y, -cosa * pos.y - sina * pos.x);

    const aspect = canvas.width / canvas.height;
    const h_ratio = 16.0 / 9.0;
    const koef = 2.0 / 12.0;

    if (aspect < h_ratio) pos.mul2(koef / aspect, koef);
    else pos.mul2(koef / h_ratio, koef * aspect / h_ratio);

    pos.add2(0, -0.55);
    if (this.dynent !== camera)
    {
        var nick = gameClient.getNickById(this.id);
        text.render(pos.toVec(), 2, nick, 1, { visibile: true, center: true, alpha: 2 });
    }
    pos.add2(0.07, -0.2);
    if (this.seria > 0)
    {
        text.render(pos.toVec(), 3, "#r+" + this.seria, 2, { visibile: true, alpha: 2 });
    }
    else if (this.seria < 0)
    {
        text.render(pos.toVec(), 3, "#w" + this.seria, 2, { visibile: true, alpha: 2 });
    }
}

//Static methods

Bot.isMutant = function(id)
{
    var skinid = id % Bot.skinnames.length;
    var skin = Bot.skinnames[skinid];
    return skin === "vazovsky" || skin === "lyaguha";
};

Bot.ready = function()
{
    for (var i = 0; i < Bot.skins.length; i++)
        if (!Bot.skins[i].ready())
            return false;
    return Bot.tex_shield.ready();
};

Bot.load = function()
{
    function LoadSkin(name, x)
    {
        var path = "textures/skins/" + name + "/";
        var skin =
        {
            body: new Texture(path + "body.png", { wrap: gl.CLAMP_TO_EDGE }),
            leg: new Texture(path + "leg.png", { wrap: gl.CLAMP_TO_EDGE }),
            legback: new Texture(path + "legback.png", { wrap: gl.CLAMP_TO_EDGE }),
            sh_body: new Texture(path + "sh_body.png", { wrap: gl.CLAMP_TO_EDGE }),
            x: x,
        };
        skin.ready = function()
        {
            return this.body.ready() &&
                   this.leg.ready() &&
                   this.legback.ready() &&
                   this.sh_body.ready();
        };
        Bot.skins[name] = skin;
        Bot.skinnames.push(name);
    }

    Bot.tex_shield = new Texture("textures/fx/botshield.png", { wrap: gl.CLAMP_TO_EDGE }),
    Bot.skins = {};
    Bot.skinnames = [];
    LoadSkin("blue_man", -0.2);
    LoadSkin("red_man", -0.2);
    LoadSkin("negr", -0.2);
    LoadSkin("vazovsky", -0.35);
    LoadSkin("lyaguha", -0.35);

    Console.addCommand("skins", "all available skins", function()
    {
        for (var s in Bot.skins)
        {
            Console.debug(s);
        }
    });
    
    var vert = Shader.vertexShader(true, false, "gl_Position");

    var frag = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        float shadow = clamp((1.0 - visible.g) * 6.0 - 3.0, 0.5, 1.0);\n\
        float contur = abs(col.a * 2.0 - 1.0);\n\
        col.rgb *= (1.0 - visible.r) * shadow * contur;\n\
        gl_FragColor = col;\n\
    }\n";

    var frag_shadow = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    varying vec4 texcoord;\n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    \n\
    void main()\n\
    {\n\
        float alpha = texture2D(tex, texcoord.xy).a;\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        float shadow = clamp((1.0 - visible.g) * 6.0 - 3.0, 0.5, 1.0);\n\
        shadow = (shadow - 0.5) * 2.0;\n\
        alpha *= 0.5 * shadow;\n\
        gl_FragColor = vec4(1.0 - alpha);\n\
    }\n";

    var frag_halo = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    uniform vec4 color;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        col.a *= 1.0 - visible.r;\n\
        gl_FragColor = color * col.aaaa;\n\
    }\n";

    Bot.shader_bot = new Shader(vert, frag,
    [
        "mat_pos", "tex", "tex_visible",
    ]);
    Bot.shader_shadow = new Shader(vert, frag_shadow,
    [
        "mat_pos", "tex", "tex_visible",
    ]);
    Bot.shader_halo = new Shader(vert, frag_halo,
    [
        "mat_pos", "tex", "tex_visible", "color",
    ]);

    Bot.snd_gib = new Sound("gib");
    Bot.snd_respawn = new Sound("respawn");
};