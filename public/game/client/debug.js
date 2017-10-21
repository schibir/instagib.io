
function DebugRender(game)
{
    var vert = Shader.vertexShader(true, false, "gl_Position");

    var frag = "\n\
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
        gl_FragColor = color * (1.0 - visible.r) * col.a;\n\
    }\n";

    var shader_dynent = new Shader(vert, frag,
    [
        "mat_pos", "tex", "tex_visible", "color",
    ]);

    var tex_dynent = new Texture("textures/debug/dynent.png");
    var tex_line = new Texture("textures/debug/line.png");

    function ready()
    {
        return tex_line.ready() && tex_dynent.ready();
    }

    var linebullets = [];
    var self = this;

    Event.on("lineshoot", function(bullet)
    {
        var render_debug = parseInt(Console.variable("render-debug", "render debug geometry", 0));
        if (render_debug) linebullets.push(bullet);
    });

    Event.on("keydown", function(key)
    {
        if (self.transport)
        {
            var cmd;
            if (key === "[") cmd = 1;
            else if (key === "]") cmd = 2;
            else return;

            self.transport.changeCamera(cmd);
        }
    });

    function renderDynents(camera, objs, size, color, isBot)
    {
        for (var i = 0; i < objs.length; i++)
        {
            var obj = objs[i];
            var col = color;
            if (isBot)
            {
                if (!obj.alive) col = [0.5, 0, 0, 0];
            }
            Dynent.render(camera, tex_dynent, shader_dynent, obj.dynent.pos, size, obj.dynent.angle,
            {
                vectors: [{ location: shader_dynent.color, vec: col, }],
            });
        }
    }

    function renderBullets(camera)
    {
        for (var index = 0; index < linebullets.length;)
        {
            var bullet = linebullets[index];
            if (Date.now() < bullet.dead || bullet.type === exports.constants.WEAPON.SHAFT)
            {
                Dynent.render(camera, tex_line, shader_dynent, bullet.dynent.pos, [0.1, bullet.dynent.size.y], bullet.dynent.angle,
                {
                    vectors: [{ location: shader_dynent.color, vec: [1, 0, 0, 0], }],
                });
                if (bullet.type === exports.constants.WEAPON.SHAFT)
                {
                    linebullets.splice(index, 1);
                }
                else index++;
            }
            else
            {
                linebullets.splice(index, 1);
            }
        }
    }

    this.render = function(bot)
    {
        if (!ready())
            return;

        var render_debug = parseInt(Console.variable("render-debug", "render debug geometry", 0));
        if (render_debug)
        {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            renderDynents(bot.dynent, game.bots, [1, 1], [0.5, 0.5, 1, 0], true);
            renderDynents(bot.dynent, game.bullets, [0.5, 0.5], [1, 0, 0, 0], false);

            var items = [];
            exports.itemForEach(game, function(item)
            {
                items.push(item);
            });

            renderDynents(bot.dynent, items, [0.5, 0.5], [0, 1, 0, 0], false);
            renderBullets(bot.dynent);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.disable(gl.BLEND);
        }

        var render_stats = parseInt(Console.variable("render-stats", "render statistics", 0));
        if (render_stats && !Console.show)
        {
            var mybot = null;
            for (var i = 0; i < game.bots.length; i++)
                if (game.bots[i].id === bot.id)
                    mybot = game.bots[i];
            assert(mybot);

            var Y = 0.1;
            text.render([0.6, Y -= 0.05], 2, "#gdynents = #w" + stats.count_dynent_rendering, 1);

            //debug
            text.render([0.6, Y -= 0.05], 2, "#gbots = #w" + game.bots.length, 1);
            text.render([0.6, Y -= 0.05], 2, "#gbullets = #w" + game.bullets.length, 1);
            text.render([0.6, Y -= 0.05], 2, "#gevents = #w" + game.events.length, 1);

            var patrons_str = "#gammo = #w[";
            for (var i = 0; i < 6; i++) patrons_str += mybot.weapon.patrons[i] + ", ";
            text.render([0.6, Y -= 0.05], 2, patrons_str + "]", 1);
            text.render([0.6, Y -= 0.05], 2, "#gweapon = #w" + mybot.weapon.type, 1);

            text.render([0.6, Y -= 0.05], 2, "#ghealth = #w" + ((mybot.health / 40) | 0), 1);

            text.render([0.6, Y -= 0.05], 2, "#gbotId = #w" + mybot.id, 1);
            text.render([0.6, Y -= 0.05], 2, "#gname = #w" + mybot.nick, 1);
            text.render([0.6, Y -= 0.05], 2, "#g------------------------------------", 1);
            text.render([0.6, Y -= 0.05], 2, "#gavg_package = #w" + (stats.memory_all_package / stats.count_net_package | 0), 1);

            if (mybot.ai)
            {
                var angle_speed = Math.round(mybot.ai.angle_speed * 100) / 100;
                var max_angle_speed = Math.round(mybot.ai.max_angle_speed * 100) / 100;
                var accuracy = Math.round(mybot.ai.accuracy * 100) / 100;
                text.render([0.6, Y -= 0.05], 2, "#greaction = #w" + mybot.ai.reaction_time, 1);
                text.render([0.6, Y -= 0.05], 2, "#gangle_speed = #w" + angle_speed, 1);
                text.render([0.6, Y -= 0.05], 2, "#gmax_angle_speed = #w" + max_angle_speed, 1);
                text.render([0.6, Y -= 0.05], 2, "#gaccuracy = #w" + accuracy, 1);
            }
        }
    }
}