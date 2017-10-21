
var config = require("config");

exports.constants =
{
    WEAPON:
    {
        PISTOL : 0,
        SHAFT  : 1,
        RAIL   : 2,
        PLASMA : 3,
        ZENIT  : 4,
        ROCKET : 5,

        RADIUS_ROCKET : 3,
        FRAME_DELTA_TIME : parseInt(config.get("game-server:update-time")),

        wea_tabl :
        [
            { vel: 0,     period: 100,  lifetime: 200, radius: 0,   damage: 300,  patrons: 1,    name: "Pistol", },
            { vel: 0,     period: 0,    lifetime: 0,   radius: 0,   damage: 3,    patrons: 7000, name: "Shaft", },
            { vel: 0,     period: 1000, lifetime: 500, radius: 0,   damage: 4000, patrons: 5,    name: "Rail", },
            { vel: 0.02,  period: 100,  lifetime: 600, radius: 0.3, damage: 800,  patrons: 50,   name: "Plasma", },
            { vel: 0.03,  period: 750,  lifetime: 400, radius: 0.3, damage: 500,  patrons: 10,   name: "Zenit", },
            { vel: 0.015, period: 750,  lifetime: 800, radius: 0.3, damage: 6000, patrons: 10,   name: "Rockets", },

            {             period: 100,                 radius: 0,   damage: 600,  },
            {             period: 0,                   radius: 0,   damage: 6,    },
            {             period: 500,                 radius: 0,   damage: 4000, },
            {             period: 100,                 radius: 0.6, damage: 1600, },
            {             period: 750,                 radius: 0.3, damage: 500,  },
            {             period: 375,                 radius: 0.3, damage: 6000, },
        ],
    },
    ITEM:
    {
        LIFE   : 6,
        SHIELD : 7,
        QUAD   : 8,
        REGEN  : 9,
        SPEED  : 10,
        COUNT  : 10,

        name :
        [
            "WeaponPistol", "WeaponShaft", "WeaponRail", "WeaponPlasma", "WeaponZenit", "WeaponRockets",
            "Life", "Shield", "Quad", "Regen", "Speed",
        ],
    },
    EVENT:
    {
        BOT_RESPAWN  : 1,
        ITEM_RESPAWN : 2,
        PAIN         : 3,
        BOT_DEAD     : 4,
        BULLET_DEAD  : 5,
        TAKE_WEAPON  : 6,
        TAKE_HEALTH  : 7,
        TAKE_SHIELD  : 8,
        TAKE_POWER   : 9,
        LINE_SHOOT   : 10,
        BULLET_RESPAWN : 11,
    },
};

