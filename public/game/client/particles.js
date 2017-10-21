"use strict";

//dir - Vector
function Particle(type, pos, dir)
{
    this.dynent = new Dynent(pos, [1, 1], Math.random() * Math.PI * 2);
    this.type = type;
    this.time = Date.now();
    this.lifetime = 400;
    this.last_update = Date.now();

    if (type & Particle.EXPLODE)
    {
        this.lifetime = 500;
        var size = type === Particle.EXPLODE_ROCKET ? 4 : 1;
        if (type === Particle.EXPLODE_PLASMA_QUAD) size = 1.5;
        this.dynent.size.set(size, size);
    }
    else if (type == Particle.RESPAWN)
    {
        this.dynent.size.set(1.5, 1.5);
        this.lifetime = 500;
    }
    else if (type & (Particle.BLOOD | Particle.SPARK))
    {
        this.dynent.angle = dir.angle() - Math.PI / 2;
        var nap = Vector.mul(dir, 0.5);
        this.dynent.pos.add(nap);
        this.dynent.size.set(2, 2);
        this.lifetime = 300;
        if (Math.random() < 0.5) this.dynent.size.x *= -1;
    }
    else if (type & Particle.SPLASH)
    {
        if (type === Particle.SPLASH_LAVA)
        {
            this.dynent.size.set(2, 2);
            this.lifetime = 400;
        }
        else if (type === Particle.SPLASH_LAVA_SMALL)
        {
            this.dynent.size.set(1, 1);
            this.lifetime = 200;
        }
        else
        {
            this.dynent.size.set(4, 4);
            this.lifetime = 500;
        }
    }
    else if (type & Particle.GIB) 
    {
        var norm = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1).mul(0.006);
        this.dynent.vel = Vector.add(norm, dir);
        this.lifetime = 10000;
        this.omega = (Math.random() * 2 - 1) * 0.03;
        this.id = (Math.random() * 8) | 0;
    }
}

Particle.prototype.update = function()
{
    var dt = Date.now() - this.last_update;
    this.last_update = Date.now();

    var delta = Date.now() - this.time;
    if (delta > this.lifetime)
    {
        if (this.type & Particle.BLOOD)
        {
            var color = this.type === Particle.BLOOD_RED ? [0.5, 0, 0, 1] : [0, 0.5, 0, 1];
            Decal.render_decal(this.dynent, Particle.spark_textures[Particle.COUNT_KADR - 1], color);
        }
        return false;
    }
    if (this.type & Particle.GIB)
    {
        this.dynent.update(dt);
        this.dynent.angle += this.omega * dt;

        this.dynent.vel.mul(0.98);
        this.omega *= 0.98;
        
        //collide map
        var level = gameClient.getLevelRender().getLevel();
        var norm = new Vector(0, 0);
        var tile = level.getNorm(norm, this.dynent.pos);
        if (tile > 128)
        {
            norm.normalize();
            var dot = norm.dot(this.dynent.vel);
            if (dot > 0)
            {
                var reflect = norm.mul(2 * dot);
                this.dynent.vel.sub(reflect);
                this.omega *= -1;
            }
        }
        //collide lava
        var my_pos = this.dynent.pos;
        if (level.collideLava(my_pos))
        {
            var bridge = level.getCollideBridges(my_pos);
            if (bridge === null)
            {
                Particle.create(Particle.SPLASH_LAVA_SMALL, this.dynent.pos, null, 1);
                return false;
            }
        }

        if (this.old_gib_pos === undefined) this.old_gib_pos = new Vector(this.dynent.pos);
        var length = Vector.sub(my_pos, this.old_gib_pos).length2();
        if (length > 0.4 * 0.4)
        {               
            var alpha = 1 - delta / this.lifetime;
            if (alpha < 0) alpha = 0;
            var rnd = this.rnd * 0.2;
            var color = this.type === Particle.GIB_RED ?
                              [0.5 + rnd, 0, 0, alpha * 0.5 + rnd] :
                              [0, 0.5 + rnd, 0, alpha * 0.5 + rnd];
            Decal.render_decal(this.dynent, Particle.tex_blood, color);
            this.old_gib_pos.copy(this.dynent.pos);
        }
    }
    return true;
};

Particle.prototype.render = function(camera)
{
    var time = Date.now();
    if (this.type & Particle.EXPLODE)
    {
        var kadr = ((time - this.time) * 8 / this.lifetime) | 0;
        if (kadr > 8 - 1) kadr = 8 - 1;
        var sx = kadr % 2 ? 0.25 : 0;
        var sy = 1 - ((kadr / 2) | 0) * 0.25;
        var dx = this.type === Particle.EXPLODE_ROCKET ? 0 : 0.5;
        var koef = this.type === Particle.EXPLODE_PLASMA_QUAD ? 1 : 0;

        this.dynent.render(camera, Particle.tex_explode, Particle.shader_explode,
        {
            vectors: [{ location: Particle.shader_explode.dtc, vec: [sx + dx, sy - 0.25, koef, 0], }],
        });
    }
    else if (this.type === Particle.SMOKE)
    {
        var alpha = (time - this.time) / this.lifetime;
        Dynent.render(camera,
                    Particle.tex_smoke,
                    Particle.shader_smoke,
                    this.dynent.pos,
                    [0.5 + alpha, 0.5 + alpha],
                    this.dynent.angle,
                    {
                        vectors: [{ location: Particle.shader_smoke.color, vec: [0, 0, 0, 1.5 - 1.5 * alpha], }],
                    });
    }
    else if (this.type === Particle.RESPAWN)
    {
        var kadr = ((time - this.time) * 16 / this.lifetime) | 0;
        if (kadr > 16 - 1) kadr = 16 - 1;
        var sx = (3 - ((kadr % 4) | 0)) / 4.0;
        var sy = 1 - ((kadr / 4) | 0) * 0.25;
        var a = (15 - kadr) / 8;
        gl.blendFunc(gl.ONE, gl.ONE);
        this.dynent.render(camera, Particle.tex_respawn, Particle.shader_respawn,
        {
            vectors:
            [
                { location: Particle.shader_respawn.dtc, vec: [sx, sy - 0.25, 0, 0], },
                { location: Particle.shader_respawn.color, vec: [1.5 * a, 1.5 * a, 3 * a, 1], },
            ],
        });
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    else if (this.type & (Particle.BLOOD | Particle.SPARK | Particle.SPLASH))
    {
        var alpha = (time - this.time) / this.lifetime;
        var kadr = ((time - this.time) * Particle.COUNT_KADR / this.lifetime) | 0;
        if (kadr > Particle.COUNT_KADR - 1)
            kadr = Particle.COUNT_KADR - 1;
        if (kadr < 0)
        {
            Console.error("Invalid kadr", kadr, "; Date.now =", time, "; this.time =", this.time);
            kadr = 0;
        }

        var color = [1, 1, 1, 1 - alpha];
        var koef = [0, 0.5, 2, 0];
        var tex = Particle.spark_textures[kadr];
        if (this.type & (Particle.BLOOD_RED | Particle.BLOOD_DEAD_RED)) color = [0.5, 0, 0, 1 - alpha];
        if (this.type & (Particle.BLOOD_GREEN | Particle.BLOOD_DEAD_GREEN)) color = [0, 0.5, 0, 1 - alpha];
        if (this.type & Particle.BLOOD)
        {
            color[3] = 1;
            koef = [0, 0.25, 4, 0];
        }
        if (this.type === Particle.SPARK) koef = [0.2, 0.4, 4, 0.2];
        if (this.type & Particle.SPLASH)
        {
            tex = Particle.splash_textures[kadr];
            koef = [0, 0.5, 2, 0];
            if (this.type & (Particle.SPLASH_LAVA | Particle.SPLASH_LAVA_SMALL))
            {
                gl.blendFunc(gl.ONE, gl.ONE);
                color = [10 - 10 * alpha, 3 - 3 * alpha, 1 - alpha, 0];
                koef = [0, 0.2, 5, 0];
            }
        }
        
        this.dynent.render(camera, tex, Particle.shader_blood,
        {
            vectors:
            [
                { location: Particle.shader_blood.color, vec: color, },
                { location: Particle.shader_blood.koef, vec: koef, },
            ],
        });
        if (this.type & (Particle.SPLASH_LAVA | Particle.SPLASH_LAVA_SMALL))
        {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
    }
    else if (this.type & Particle.GIB)
    {
        var sx = ((this.id % 4) | 0) * 0.25;
        var sy = ((this.id / 4) | 0) * 0.25;
        if (this.type === Particle.GIB_RED) sy += 0.5;
        var d = 10 - 10 * (time - this.time) / this.lifetime;
        if (d > 1) d = 1;

        this.dynent.render(camera, Particle.tex_gibs, Particle.shader_gib,
        {
            vectors:
            [
                { location: Particle.shader_gib.dtc, vec: [sx, sy, 0, 0], },
                { location: Particle.shader_gib.color, vec: [1, 1, 1, d], },
            ],
        });
    }
};

Event.on("cl_botrespawn", function(pos)
{
    Particle.create(Particle.RESPAWN, pos, null, 1);
});

Event.on("cl_botpain", function(pos, dir, id)
{
    Particle.create(Bot.isMutant(id) ? Particle.BLOOD_GREEN : Particle.BLOOD_RED, pos, dir, 1);
});

Event.on("cl_botdead", function(pos, dir, id)
{
    var count_gibs = parseInt(Console.variable("gibs-count", "count of gibs in dead bot", 10));
    Particle.create(Bot.isMutant(id) ? Particle.GIB_GREEN : Particle.GIB_RED, pos, dir, count_gibs);
    //blood
    var type = Bot.isMutant(id) ? Particle.BLOOD_DEAD_GREEN : Particle.BLOOD_DEAD_RED;

    var level = gameClient.getLevelRender().getLevel();
    if (level.collideLava(pos))
    {
        var bridge = level.getCollideBridges(pos);
        if (bridge === null) type = Particle.SPLASH_LAVA;
    }
    Particle.create(type, pos, null, 1);
});

Event.on("cl_bulletlinecollide", function(bullet, dest, norm_dir)
{
    if (bullet.type === WEAPON.PISTOL)
    {
        var level = gameClient.getLevelRender().getLevel();
        if (level.collideLava(dest) && !level.getCollideBridges(dest))
        {
            Particle.create(Particle.SPLASH_LAVA_SMALL, dest, null, 1);
            //guano
        }
        else
        {
            var norm = new Vector(norm_dir);
            var tile = level.getCollide(dest);
            if (tile > 100) norm.mul(-1);
            Particle.create(Particle.SPARK, dest, norm, 1);
            var rnd = Math.random() * 3 | 0;
            Weapon.snd_ric[rnd].play(dest);
        }
    }
});

Event.on("cl_bulletdead", function(bullet)
{
    if (bullet.type == WEAPON.PLASMA)
    {
        var level = gameClient.getLevelRender().getLevel();
        if (level.collideLava(bullet.dynent.pos) && !level.getCollideBridges(bullet.dynent.pos))
        {
            Particle.create(Particle.SPLASH_LAVA_SMALL, bullet.dynent.pos, null, 1);
            //guano
        }
        else
        {
            var isQuad = bullet.power === ITEM.QUAD;
            Particle.create(isQuad ? Particle.EXPLODE_PLASMA_QUAD :
                                     Particle.EXPLODE_PLASMA, bullet.dynent.pos, null, 1);
            Decal.render_decal(
            {
                pos: bullet.dynent.pos,
                angle: Math.random() * Math.PI * 2,
                size: isQuad ? new Vector(1.5, 1.5) : new Vector(1, 1),
            }, Weapon.tex_decal, [0.2, 0.2, 0.2, 1]);
            Weapon.snd_grenade.play(bullet.dynent.pos);
        }
    }
    else if (bullet.type == WEAPON.ROCKET)
    {
        Particle.create(Particle.EXPLODE_ROCKET, bullet.dynent.pos, null, 1);
        Decal.render_decal(
        {
            pos: bullet.dynent.pos,
            angle: Math.random() * Math.PI * 2,
            size: new Vector(3, 3),
        }, Weapon.tex_decal, [0.2, 0.2, 0.2, 1]);
        Weapon.snd_explode.play(bullet.dynent.pos);
    }
});

// static methods

Particle.ready = function()
{
    return Particle.tex_explode.ready() &&
           Particle.tex_smoke.ready() &&
           Particle.tex_respawn.ready() &&
           Particle.tex_gibs.ready() &&
           Particle.tex_blood.ready();
};

Particle.load = function()
{
    Particle.COUNT_KADR = 32;

    function create_spark()
    {
        var time = Date.now();
        const COUNT_PART = 32;
        const SIZE = 64;
        const LENGTH = 8;
        
        var ret = [];
        var pos = new Array(COUNT_PART);
        var vel = new Array(COUNT_PART);
        var len = new Array(COUNT_PART);
        
        for (var i = 0; i < COUNT_PART; i++)
        {
            var sx = (Math.random() * 2 - 1) * 0.75;
            var sy = -(1 + Math.random()) * 0.75;
            var px = SIZE / 2 + Math.random() * sx * 16 + sx;
            var py = SIZE - 12 + sy;
            pos[i] = new Vector(px, py);
            vel[i] = new Vector(sx, sy);
            len[i] = (Math.random() + 0.5) * LENGTH;
        }

        for (var i = 0; i < Particle.COUNT_KADR; i++)
        {
            var buf = new Buffer(SIZE);
            for (var j = 0; j < COUNT_PART; j++) 
            {
                var x = pos[j].x | 0;
                var y = pos[j].y | 0;
                buf.bresenham(x, y, (x - vel[j].x * len[j]) | 0, (y - vel[j].y * len[j]) | 0, 1);
                pos[j].add(vel[j]);
            }
            var blured_buf = buf.getGaussian(5);
            var clamped_buf = new Buffer(SIZE);
            clamped_buf.copy(blured_buf);
            clamped_buf.clamp(0, 0.2).normalize(0, 1);
            ret.push(Buffer.create_texture(clamped_buf, blured_buf, blured_buf, blured_buf, { wrap: gl.CLAMP_TO_EDGE }));
        }
        Console.info("Create spark = ", Date.now() - time);
        return ret;
    }
    function create_splash()
    {
        var time = Date.now();
        const COUNT_PART = 128;
        const SIZE = 64;
        const LENGTH = 16;
        
        var ret = [];
        var pos = new Array(COUNT_PART);
        var vel = new Array(COUNT_PART);
        var len = new Array(COUNT_PART);
        
        for (var i = 0; i < COUNT_PART; i++)
        {
            var sx = (Math.random() * 2 - 1);
            var sy = (Math.random() * 2 - 1);
            var px = SIZE / 2 + Math.random() * sx * 16 + sx;
            var py = SIZE / 2 + Math.random() * sy * 16 + sy;
            pos[i] = new Vector(px, py);
            vel[i] = new Vector(sx, sy).normalize().mul(0.6);
            len[i] = LENGTH;
        }

        for (var i = 0; i < Particle.COUNT_KADR; i++)
        {
            var buf = new Buffer(SIZE);
            for (var j = 0; j < COUNT_PART; j++) 
            {
                var x = pos[j].x | 0;
                var y = pos[j].y | 0;
                var koef = (Particle.COUNT_KADR - i) / Particle.COUNT_KADR * 2;
                buf.bresenham(x, y, (x - vel[j].x * len[j]) | 0, (y - vel[j].y * len[j]) | 0, koef);
                pos[j].add(vel[j]);
            }
            var blured_buf = buf.getGaussian(4).clamp(0, 1);
            var clamped_buf = new Buffer(SIZE);
            clamped_buf.copy(blured_buf);
            clamped_buf.clamp(0, 0.2).normalize(0, 1);
            ret.push(Buffer.create_texture(clamped_buf, blured_buf, blured_buf, blured_buf, { wrap: gl.CLAMP_TO_EDGE }));
        }
        Console.info("Create splash = ", Date.now() - time);
        return ret;
    }

    Particle.spark_textures = create_spark();
    Particle.splash_textures = create_splash();

    //type
    Particle.EXPLODE_ROCKET = 1;
    Particle.EXPLODE_PLASMA = 2;
    Particle.EXPLODE_PLASMA_QUAD = 4096 * 2;
    Particle.EXPLODE = Particle.EXPLODE_ROCKET | Particle.EXPLODE_PLASMA | Particle.EXPLODE_PLASMA_QUAD;
    Particle.SMOKE = 4;
    Particle.RESPAWN = 8;
    Particle.BLOOD_RED = 16;
    Particle.BLOOD_GREEN = 32;
    Particle.BLOOD = Particle.BLOOD_RED | Particle.BLOOD_GREEN;
    Particle.BLOOD_DEAD_RED = 64;
    Particle.BLOOD_DEAD_GREEN = 128;
    Particle.SPLASH_LAVA = 256;
    Particle.SPLASH_LAVA_SMALL = 512;
    Particle.SPLASH = Particle.BLOOD_DEAD_RED | Particle.BLOOD_DEAD_GREEN | Particle.SPLASH_LAVA | Particle.SPLASH_LAVA_SMALL;
    Particle.GIB_RED = 1024;
    Particle.GIB_GREEN = 2048;
    Particle.GIB = Particle.GIB_RED | Particle.GIB_GREEN;
    Particle.SPARK = 4096;

    Particle.PARTICLE_LAYER_0 = Particle.GIB | Particle.SPARK;
    Particle.PARTICLE_LAYER_1 = Particle.RESPAWN | Particle.BLOOD | Particle.SPLASH;
    Particle.PARTICLE_LAYER_2 = Particle.EXPLODE | Particle.SMOKE;

    Particle.tex_explode = new Texture("textures/fx/particles/explode.png");
    Particle.tex_smoke = new Texture("textures/fx/particles/smoke.png");
    Particle.tex_respawn = new Texture("textures/fx/particles/respawn.png");
    Particle.tex_gibs = new Texture("textures/fx/particles/gibs.png");
    Particle.tex_blood = new Texture("textures/fx/particles/blood.png");

    Particle.particles = [];

    var vert = Shader.vertexShader(true, false, "gl_Position");

    var vert_explode = "\n\
    attribute vec4 position;\n\
    \n\
    uniform mat4 mat_pos;\n\
    uniform vec4 dtc;\n\
    varying vec4 texcoord;\n\
    varying vec4 koef;\n\
    \n\
    void main()\n\
    {\n\
        gl_Position = mat_pos * position;\n\
        texcoord.xy = position.xy * 0.5 + 0.5;\n\
        texcoord.xy = texcoord.xy * 0.25 + dtc.xy;\n\
        texcoord.zw = gl_Position.xy * 0.5 + 0.5;\n\
        koef = dtc.zzzz;\n\
    }\n";

    var frag_explode = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    varying vec4 texcoord;\n\
    varying vec4 koef;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        col *= 1.0 - visible.r;\n\
        col.a = (col.r + col.g + col.b) * 0.33;\n\
        gl_FragColor = mix(col, col.grba * 2.0, koef.r);\n\
    }\n";

    var frag_smoke = "\n\
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
        col *= 1.0 - visible.r;\n\
        gl_FragColor = vec4(col.rgb, col.r * color.a);\n\
    }\n";

    var frag_blood = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    uniform vec4 color;\n\
    uniform vec4 koef;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        col = (clamp(col.gggg, koef.x, koef.y) - koef.w) * koef.z;\n\
        col *= 1.0 - visible.r;\n\
        gl_FragColor = col * color;\n\
    }\n";

    var frag_color = "\n\
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
        float shadow = clamp((1.0 - visible.g) * 6.0 - 3.0, 0.5, 1.0);\n\
        col *= (1.0 - visible.r) * color;\n\
        gl_FragColor = col;\n\
    }\n";

    Particle.shader_explode = new Shader(vert_explode, frag_explode, 
    [
        "mat_pos", "dtc", "tex", "tex_visible",
    ]);
    Particle.shader_smoke = new Shader(vert, frag_smoke, 
    [
        "mat_pos", "tex", "tex_visible", "color",
    ]);
    Particle.shader_respawn = new Shader(vert_explode, Weapon.frag_noshadow_color,
    [
        "mat_pos", "dtc", "tex", "tex_visible", "color",
    ]);
    Particle.shader_blood = new Shader(vert, frag_blood,
    [
        "mat_pos", "tex", "tex_visible", "color", "koef",
    ]);
    Particle.shader_gib = new Shader(vert_explode, frag_color,
    [
        "mat_pos", "dtc", "tex", "tex_visible", "color",
    ]);
};

//dir - Vector
Particle.create = function(type, pos, dir, count)
{
    for (var i = 0; i < count; i++)
    {
        var particle = new Particle(type, pos, dir);
        particle.rnd = Math.random();
        Particle.particles.push(particle);
    }
};

Particle.render = function(camera, layer)
{
    gl.enable(gl.BLEND);
    for (var index = 0; index < Particle.particles.length;)
    {
        var particle = Particle.particles[index];
        var not_skip = layer === 0 && (particle.type & Particle.PARTICLE_LAYER_0);
        not_skip = not_skip || (layer === 1 && (particle.type & Particle.PARTICLE_LAYER_1));
        not_skip = not_skip || (layer === 2 && (particle.type & Particle.PARTICLE_LAYER_2));
        var deleted = false;
        if (not_skip)
        {
            particle.render(camera);
            if (!particle.update())
            {
                Particle.particles.splice(index, 1);
                deleted = true;
            }
        }
        if (!deleted)
            index++;
    }
    gl.disable(gl.BLEND);
};