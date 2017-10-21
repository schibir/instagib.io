"use strict";

function WeaponClient(type, shoot)
{
    this.type = WEAPON.PISTOL;
    this.shooting = false;
    this.dead = 0;

    this.setType(type);
    if (shoot) this.shoot();
}

WeaponClient.prototype.setType = function(type)
{
    if (this.type !== type)
    {
        this.type = type;
        this.shooting = false;
    }
};

WeaponClient.prototype.shoot = function()
{
    if (!this.shooting || this.type === WEAPON.SHAFT)
    {
        this.shooting = true;
        this.dead = Date.now() + WeaponClient.wea_tabl[this.type].lifetime;
    }
};

WeaponClient.prototype.renderShadow = function(camera, owner)
{
    var sina = Math.sin(owner.dynent.angle);
    var cosa = Math.cos(owner.dynent.angle);

    var pos = Vector.sub(owner.dynent.pos, sun_direction);
    pos.add2(cosa * 0.25 - sina * 0.4, -cosa * 0.4 - sina * 0.25);
    Dynent.render(camera, Weapon.skins[this.type].shadow, Bot.shader_shadow, pos, [1.2, 1.2], owner.dynent.angle);
};

WeaponClient.prototype.render = function(camera, owner)
{
    var sina = Math.sin(owner.dynent.angle);
    var cosa = Math.cos(owner.dynent.angle);
    var pos = Vector.add2(owner.dynent.pos, cosa * 0.25 - sina * 0.4, -cosa * 0.4 - sina * 0.25);
    Dynent.render(camera, Weapon.skins[this.type].gun, Bot.shader_bot, pos, [1, 1], owner.dynent.angle);

    if (Date.now() > this.dead)
        this.shooting = false;

    if (this.shooting && this.type <= WEAPON.RAIL)
    {
        var state =
        {
            vectors: [{location: Weapon.shader_noshadow_color.color, vec: []}]
        };
        var timeleft = (this.dead - Date.now()) / WeaponClient.wea_tabl[this.type].alphatime;
        timeleft = Math.max(timeleft, 0);

        var Y = WeaponClient.wea_tabl[this.type].Y;
        var owner_pos = Vector.add2(owner.dynent.pos, cosa * 0.25 - sina * Y, -cosa * Y - sina * 0.25);

        if      (this.type === WEAPON.PISTOL)   state.vectors[0].vec = owner.power === ITEM.QUAD ? [1, 0.8, 0.6, timeleft] : [1, 1, 1, timeleft];
        else if (this.type === WEAPON.SHAFT)    state.vectors[0].vec = owner.power === ITEM.QUAD ? [1.5, 0.7, 0.7, 0] : [0.7, 0.7, 1.5, 0];
        else if (this.type === WEAPON.RAIL)     state.vectors[0].vec = [timeleft * 2, timeleft, timeleft, 0];

        if (this.type !== WEAPON.PISTOL) gl.blendFunc(gl.ONE, gl.ONE);

        Dynent.render(camera,
                      Weapon.skins[this.type].fire,
                      Weapon.shader_noshadow_color,
                      owner_pos,
                      WeaponClient.wea_tabl[this.type].size,
                      owner.dynent.angle, state);

        if (this.type !== WEAPON.PISTOL) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
};

//Static methods

Weapon.ready = function()
{
    for (var i = 0; i < Weapon.skins.length; i++)
        if (!Weapon.skins[i].ready())
            return false;
    return Weapon.skins[WEAPON.PLASMA].bullet_quad.ready() && Weapon.tex_decal.ready();
};

Weapon.load = function()
{
    function loadWeapon(name, id, fire)
    {
        var path = "textures/weapons/" + name + "/";
        var skin =
        {
            gun: new Texture(path + "gun.png"),
            shadow: new Texture(path + "shadow.png"),
            bullet: new Texture(path + "bullet.png"),
            fire: fire ? new Texture(path + "fire.png") : null,
            snd_shoot: new Sound(name),
        };
        skin.ready = function()
        {
            return this.gun.ready() &&
                   this.shadow.ready() &&
                   this.bullet.ready() &&
                   (!this.fire || this.fire.ready());
        };
        Weapon.skins[id] = skin;
    }

    WeaponClient.wea_tabl =
    [
        { lifetime: 100,  alphatime: 50,  Y: 1.3, size: [1, 1] },
        { lifetime: 100,  alphatime: 50,  Y: 0.9, size: [1, 1] },
        { lifetime: 1000, alphatime: 500, Y: 0.9, size: [0.75, 0.75] },
        { lifetime: 0,    alphatime: 50,  Y: 0.0, size: [1, 1] },
        { lifetime: 0,    alphatime: 50,  Y: 0.0, size: [1, 1] },
        { lifetime: 0,    alphatime: 50,  Y: 0.0, size: [1, 1] },
    ];

    Weapon.skins = [];
    loadWeapon("pistol", WEAPON.PISTOL, true);
    loadWeapon("shaft",  WEAPON.SHAFT,  true);
    loadWeapon("rail",   WEAPON.RAIL,   false);
    loadWeapon("plasma", WEAPON.PLASMA, false);
    loadWeapon("zenit",  WEAPON.ZENIT,  false);
    loadWeapon("rocket", WEAPON.ROCKET, false);

    Weapon.skins[WEAPON.RAIL].fire = Weapon.skins[WEAPON.SHAFT].fire;
    Weapon.skins[WEAPON.PISTOL].snd_shoot.setVolume(0.5);
    Weapon.skins[WEAPON.SHAFT].snd_shoot.snd.loop(true);
    Weapon.skins[WEAPON.PLASMA].bullet_quad = new Texture("textures/weapons/plasma/bullet_quad.png");

    Weapon.tex_decal = new Texture("textures/fx/particles/decal.png");
    Weapon.snd_explode = new Sound("exp");
    Weapon.snd_grenade = new Sound("grenade");
    Weapon.snd_ric = [ new Sound("ric1"), new Sound("ric2"), new Sound("ric3"), ];
    Weapon.snd_ric.forEach(function(snd)
    {
        snd.setVolume(0.5);
    });

    var vert = Shader.vertexShader(true, false, "gl_Position");
    var vert_tex = Shader.vertexShader(true, true, "gl_Position");

    var frag_noshadow = "\n\
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
        col *= 1.0 - visible.r;\n\
        gl_FragColor = col;\n\
    }\n";

    Weapon.frag_noshadow_color = "\n\
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
        col *= (1.0 - visible.r) * color;\n\
        gl_FragColor = col;\n\
    }\n";

    var vert_shaft = "\n\
    attribute vec4 position;\n\
    uniform mat4 mat_pos;\n\
    uniform mat4 mat_tex;\n\
    uniform vec4 norm_dir;\n\
    varying vec4 texcoord;\n\
    varying vec4 vertexpos;\n\
    \n\
    void main()\n\
    {\n\
        vec2 dir = normalize(norm_dir.xy);\n\
        vec2 normal = vec2(-dir.y, dir.x);\n\
        vec2 nap = normalize(norm_dir.zw);\n\
        float proj = dot(normal, nap);\n\
        float koef = (1.0 - position.y * position.y) * length(norm_dir.zw) * 0.6;\n\
        vec4 pos = vec4(position.x - proj * koef, position.yzw);\n\
        gl_Position = mat_pos * pos;\n\
        texcoord = mat_tex * position;\n\
        vertexpos = position;\n\
        texcoord.zw = gl_Position.xy * 0.5 + 0.5;\n\
    }\n";

    var frag_shaft = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    uniform vec4 color;\n\
    varying vec4 texcoord;\n\
    varying vec4 vertexpos;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, texcoord.zw);\n\
        col *= (1.0 - visible.r) * color;\n\
        float koef = clamp((1.0 - vertexpos.y * vertexpos.y) * 3.0, 0.0, 1.0);\n\
        col *= koef;\n\
        gl_FragColor = col;\n\
    }\n";

    Weapon.shader_noshadow = new Shader(vert, frag_noshadow,
    [
        "mat_pos", "tex", "tex_visible",
    ]);
    Weapon.shader_noshadow_color = new Shader(vert, Weapon.frag_noshadow_color,
    [
        "mat_pos", "tex", "tex_visible", "color",
    ]);
    Weapon.shader_noshadow_color_tex = new Shader(vert_tex, Weapon.frag_noshadow_color,
    [
        "mat_pos", "mat_tex", "tex", "tex_visible", "color",
    ]);
    Weapon.shader_shaft = new Shader(vert_shaft, frag_shaft,
    [
        "mat_pos", "mat_tex", "tex", "tex_visible", "color", "norm_dir",
    ]);

    var current_buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    Weapon.COUNT_SEGMENTS = 8;
    Weapon.shaft_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Weapon.shaft_buffer);
    var vertices = [];
    for (var i = 0; i <= Weapon.COUNT_SEGMENTS; i++)
    {
        vertices.push(-1.0);
        vertices.push(-1.0 + 2 / Weapon.COUNT_SEGMENTS * i);
        vertices.push(1.0);
        vertices.push(-1.0 + 2 / Weapon.COUNT_SEGMENTS * i);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, current_buffer);
};