"use strict";

//pos - Vector
function BulletClient(type, pos, angle, power, id)
{
    this.type = type;
    this.power = power
    this.id = id;
    this.dynent = new Dynent(pos, [1, 1], angle);
    
    var norm_dir = new Vector(-Math.sin(angle), -Math.cos(angle));
    this.dynent.vel = Vector.mul(norm_dir, WEAPON.wea_tabl[type].vel);
    
    this.dead = Date.now() + WEAPON.wea_tabl[type].lifetime;
    this.last_update = Date.now();
}

BulletClient.prototype.update = function()
{
    var delta = Date.now() - this.last_update;
    this.last_update = Date.now();
    
    if (Date.now() > this.dead)
        return false;

    if (this.type >= WEAPON.PLASMA)
    {
        this.dynent.update(delta);

        //collide map
        var level = gameClient.getLevelRender().getLevel();
        if (this.type === WEAPON.ZENIT)
        {
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
                    this.dynent.angle = this.dynent.vel.angle() - Math.PI / 2;
                }
            }
        }
        else
        {
            if (level.getCollide(this.dynent.pos) > 128)
                return false;
        }
        
        if (this.type === WEAPON.ROCKET)
        {
            Particle.create(Particle.SMOKE, this.dynent.pos, null, 1);
        }
    }
    return true;
};

BulletClient.prototype.render = function(camera)
{
    if (this.type === WEAPON.ZENIT)
    {
        var alpha = (this.dead - Date.now()) / 250;
        if (alpha > 1) alpha = 1;
        this.dynent.render(camera, Weapon.skins[this.type].bullet, Weapon.shader_noshadow_color,
        {
            vectors: [{ location: Weapon.shader_noshadow_color.color, vec: [1, 1, 1, alpha], }],
        });
    }
    else
    {
        if (this.power === ITEM.QUAD && this.type === WEAPON.PLASMA)
        {
            this.dynent.size.set(1.5, 1.5);
            this.dynent.render(camera, Weapon.skins[this.type].bullet_quad, Weapon.shader_noshadow_color,
            {
                vectors: [{ location: Weapon.shader_noshadow_color.color, vec: [1, 1, 1, 2.5], }],
            });
        }
        else
        {
            this.dynent.render(camera, Weapon.skins[this.type].bullet, Weapon.shader_noshadow);
        }
    }
};

function BulletLine(type, pos, angle, power, size_y, dest)
{
    this.type = type;
    this.power = power
    this.dynent = new Dynent(pos, [0.5, size_y], angle);
    this.dest = dest;
    
    this.norm_dir = new Vector(-Math.sin(angle), -Math.cos(angle));
    
    this.dead = Date.now() + WEAPON.wea_tabl[type].lifetime;
}

BulletLine.prototype.update = function()
{
    return Date.now() < this.dead;
};

BulletLine.prototype.render = function(camera)
{
    var state =
    {
        vectors: [],
    };
    var timeleft = (this.dead - Date.now()) / WEAPON.wea_tabl[this.type].period;
    if (this.type === WEAPON.PISTOL) 
    {
        var color = this.power === ITEM.QUAD ? [1, 0.8, 0.6, timeleft] : [1, 1, 1, timeleft];
        state.vectors.push(
        {
            location: Weapon.shader_noshadow_color.color,
            vec: color,
        });
        this.dynent.render(camera, Weapon.skins[this.type].bullet, Weapon.shader_noshadow_color, state);
    }
    else if (this.type === WEAPON.RAIL)
    {
        gl.blendFunc(gl.ONE, gl.ONE);

        var mat_tex = mat4.create();
        mat4.trans(mat_tex, [0.5, 0.5]);
        mat4.scal(mat_tex, [0.5, 0.5 * this.dynent.size.y]);

        state.vectors.push(
        {
            location: Weapon.shader_noshadow_color_tex.color,
            vec: [timeleft * 5, timeleft * 2.5, timeleft * 2.5, timeleft],
        });
        state.mat_tex = mat_tex;

        this.dynent.render(camera, Weapon.skins[this.type].bullet, Weapon.shader_noshadow_color_tex, state);

        mat4.identity(mat_tex);
        mat4.trans(mat_tex, [0.5, 0.5]);
        mat4.scal(mat_tex, [0.5, 0.5]);

        var level = gameClient.getLevelRender().getLevel();
        if (level.collideLava(this.dest) && !level.getCollideBridges(this.dest))
        {
            Particle.create(Particle.SPLASH_LAVA_SMALL, this.dest, null, 1);
        }
        else
        {
            Dynent.render(camera,
                          Weapon.skins[this.type].fire,
                          Weapon.shader_noshadow_color_tex,
                          this.dest, [0.5, 0.5], 0, state);
        }

        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
};

function BulletShaft(pos, angle, power, size_y, dest, norm_dir, nap, ownerid, time)
{
    this.type = WEAPON.SHAFT;
    this.power = power
    this.dynent = new Dynent(pos, [0.5, size_y], angle);
    this.dest = dest;
    this.nap = nap;
    this.ownerid = ownerid;
    this.norm_dir = norm_dir;
    this.sound = null;
    this.time = time;
    this.my_time = Date.now();
    this.del = false;

    this.new_bul = this;
    this.old_bul = this;
}

BulletShaft.prototype.addBullet = function(bullet)
{
    this.del = false;
    this.power = bullet.power;
    this.sound = bullet.sound;
    this.my_time = Date.now();

    this.old_bul = this.new_bul;
    this.new_bul = bullet;
};

BulletShaft.prototype.update = function()
{
    var new_time = this.new_bul.time;
    var old_time = this.old_bul.time;
    var update_server_time = parseInt(config.get("game-server:update-time"));
    var current_time = new_time + (Date.now() - this.my_time) - update_server_time;
    var koef = (current_time - old_time) / (new_time - old_time);
    if (koef < 0) koef = 0;

    if (this.new_bul !== this.old_bul && this.old_bul !== this)
    {
        this.dynent.interpolate(this.old_bul.dynent, this.new_bul.dynent, koef);
        this.dynent.size.interpolate(this.old_bul.dynent.size, this.new_bul.dynent.size, koef);
        this.dest.interpolate(this.old_bul.dest, this.new_bul.dest, koef);
        this.nap.interpolate(this.old_bul.nap, this.new_bul.nap, koef);
        this.norm_dir.interpolate(this.old_bul.norm_dir, this.new_bul.norm_dir, koef);
    }

    var bot = gameClient.getBotById(this.ownerid);
    if (bot)
    {
        var Y = 0.9;
        var angle = bot.dynent.angle;
        var sina = Math.sin(angle);
        var cosa = Math.cos(angle);
        var position = Vector.add2(bot.dynent.pos, cosa * 0.25 - sina * Y, -cosa * Y - sina * 0.25);
        
        this.dynent.pos.copy(position);
        this.norm_dir.set(-sina, -cosa);
        this.nap = Vector.sub(this.dest, position);
        this.dynent.angle = this.nap.angle() - Math.PI / 2;

        var len = this.nap.length();
        this.dynent.pos.add(this.dest).mul(0.5);
        this.dynent.size.set(0.5, len);
    }

    Event.emit("cl_bulletlinecollide", this, this.dest, this.norm_dir);

    if (this.del)
    {
        Weapon.skins[this.type].snd_shoot.snd.stop(this.sound);
    }
    return !this.del;
};

BulletShaft.prototype.render = function(camera)
{
    var state =
    {
        vectors: [],
    };
    gl.blendFunc(gl.ONE, gl.ONE);

    var mat_tex = mat4.create();
    mat4.trans(mat_tex, [0.5, 0.5]);
    mat4.scal(mat_tex, [0.5, 0.5]);
    var color = this.power === ITEM.QUAD ? [1.5, 0.7, 0.7, 0] : [0.7, 0.7, 1.5, 0];
    state.vectors.push(
    {
        location: Weapon.shader_noshadow_color_tex.color,
        vec: color,
    });
    state.mat_tex = mat_tex;

    var level = gameClient.getLevelRender().getLevel();
    if (level.collideLava(this.dest) && !level.getCollideBridges(this.dest))
    {
        Particle.create(Particle.SPLASH_LAVA_SMALL, this.dest, null, 1);
    }
    else
    {
        Dynent.render(camera,
                      Weapon.skins[this.type].fire,
                      Weapon.shader_noshadow_color_tex,
                      this.dest, [1, 1], 0, state);
    }

    mat4.identity(mat_tex);
    mat4.trans(mat_tex, [0.5, -(Date.now() % 300) / 300]);
    mat4.scal(mat_tex, [0.5, 0.5 * this.dynent.size.y]);
    this.dynent.size.x = 1;

    var current_buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    gl.bindBuffer(gl.ARRAY_BUFFER, Weapon.shaft_buffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    state.vertices_count = (Weapon.COUNT_SEGMENTS + 1) * 2;
    state.vectors[0].location = Weapon.shader_shaft.color;
    state.vectors.push(
    {
        location: Weapon.shader_shaft.norm_dir,
        vec: [this.norm_dir.x, this.norm_dir.y, this.nap.x, this.nap.y],
    });
    this.dynent.render(camera, Weapon.skins[this.type].bullet, Weapon.shader_shaft, state);

    gl.bindBuffer(gl.ARRAY_BUFFER, current_buffer);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
};

BulletClient.bullets = [];
BulletLine.bullets = [];
BulletShaft.bullets = [];

BulletClient.remove = function(bullet_id)
{
    for (var i = 0; i < BulletClient.bullets.length; i++)
        if (BulletClient.bullets[i].id === bullet_id)
        {
            Event.emit("cl_bulletdead", BulletClient.bullets[i]);
            return BulletClient.bullets.splice(i, 1);
        }
};

BulletClient.create = function(bullet)
{
    if (bullet.bullet_type === WEAPON.ZENIT) BulletClient.remove(bullet.bulletid);
    BulletClient.bullets.push(new BulletClient(bullet.bullet_type, bullet.pos, bullet.angle, bullet.power, bullet.bulletid));
    if (bullet.sound)
    {
        var id = Weapon.skins[bullet.bullet_type].snd_shoot.play(bullet.pos);
        if (bullet.power === ITEM.QUAD)
        {
            Weapon.skins[bullet.bullet_type].snd_shoot.snd.rate(2, id);
        }
    }
};

Event.on("frame", () =>
{
    BulletShaft.bullets.forEach((bullet) =>
    {
        bullet.del = true;
    });
});

BulletShaft.create = function(server_time, bullet)
{
    var bul = new BulletShaft(bullet.pos, bullet.angle, bullet.power, bullet.size_y,
                              bullet.dest, bullet.norm_dir, bullet.nap, bullet.ownerid, server_time);
    for (var i = 0; i < BulletShaft.bullets.length; i++)
        if (BulletShaft.bullets[i].ownerid === bullet.ownerid)
        {
            bul.sound = BulletShaft.bullets[i].sound;
            Weapon.skins[bul.type].snd_shoot.volume(bul.dynent.pos, bul.sound);
            if (bul.power === ITEM.QUAD)
            {
                Weapon.skins[bul.type].snd_shoot.snd.rate(2, bul.sound);
            }
            else
            {
                Weapon.skins[bul.type].snd_shoot.snd.rate(1, bul.sound);
            }
            BulletShaft.bullets[i].addBullet(bul);
            return;
        }
    bul.sound = Weapon.skins[bul.type].snd_shoot.snd.play();
    Weapon.skins[bul.type].snd_shoot.volume(bul.dynent.pos, bul.sound);
    BulletShaft.bullets.push(bul);
};

BulletLine.create = function(server_time, bullet)
{
    if (bullet.bullet_type === WEAPON.SHAFT)
        return BulletShaft.create(server_time, bullet);

    var bul = new BulletLine(bullet.bullet_type, bullet.pos, bullet.angle, bullet.power, bullet.size_y, bullet.dest);
    BulletLine.bullets.push(bul);
    var norm_dir = new Vector(-Math.sin(bullet.angle), -Math.cos(bullet.angle));
    Event.emit("cl_bulletlinecollide", bul, bullet.dest, norm_dir);
    Event.emit("cl_lineshoot", bul);
};

function renderBullets(camera, bullets, need_emit)
{
    for (var index = 0; index < bullets.length;)
    {
        var bullet = bullets[index];
        if (bullet.update())
        {
            bullet.render(camera);
            index++;
        }
        else
        {
            if (need_emit) Event.emit("cl_bulletdead", bullet);
            bullets.splice(index, 1);
        }
    }
}

BulletClient.render = function(camera)
{
    gl.enable(gl.BLEND);
    renderBullets(camera, BulletClient.bullets, true);
    renderBullets(camera, BulletLine.bullets, false);
    renderBullets(camera, BulletShaft.bullets, false);
    gl.disable(gl.BLEND);
};