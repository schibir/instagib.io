"use strict";

Item.render = function(camera, item)
{
    var angle = item.type <= ITEM.LIFE ?
            ((Date.now() % 3000) / 3000) * Math.PI * 2 :
            camera.angle;

    if (item.type <= WEAPON.ROCKET)
    {
        Dynent.render(camera, Weapon.skins[item.type].gun, Weapon.shader_noshadow,
            new Vector(item.x, item.y), [1, 1], angle);
    }
    else
    {
        Dynent.render(camera, Item.tex_powerup[item.type - ITEM.LIFE], Weapon.shader_noshadow,
            new Vector(item.x, item.y), [1, 1], angle);
    }
};

Item.load = function()
{
    Item.tex_powerup =
    [
        new Texture("textures/fx/life.png"),
        new Texture("textures/fx/shield.png"),
        new Texture("textures/fx/quad.png"),
        new Texture("textures/fx/regen.png"),
        new Texture("textures/fx/speed.png"),
    ];

    Item.snd_health = new Sound("health");
    Item.snd_weapon = new Sound("pkup");
    Item.snd_power = new Sound("power");
    Item.snd_respawn = new Sound("resp_b");
};

Item.ready = function()
{
    for (var i = 0; i < Item.tex_powerup.length; i++)
    {
        if (!Item.tex_powerup[i].ready())
            return false;
    }
    return true;
};