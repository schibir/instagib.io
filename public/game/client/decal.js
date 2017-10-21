"use strict";

function Decal(size_class)
{
    var vert = Shader.vertexShader(true, false, "gl_Position");
    var frag_blit = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.zw);\n\
        gl_FragColor = col;\n\
    }\n";

    var frag_lerp = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_dest;\n\
    uniform vec4 color;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 dest = texture2D(tex_dest, texcoord.zw);\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 source = vec4(color.rgb, col.r * color.a);\n\
        gl_FragColor = vec4(mix(dest.rgb, source.rgb, source.a), max(source.a, dest.a));\n\
    }\n";

    var frag_add = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_dest;\n\
    uniform vec4 color;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 dest = texture2D(tex_dest, texcoord.zw);\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 source = color * col.rrrr;\n\
        gl_FragColor = dest + source;\n\
    }\n";

    var frag_drying = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        gl_FragColor = col * 0.98;\n\
    }\n";

    var shader_blit = new Shader(vert, frag_blit,
    [
        "mat_pos", "tex",
    ]);
    var shader_lerp = new Shader(vert, frag_lerp,
    [
        "mat_pos", "tex", "tex_dest", "color",
    ]);
    var shader_add = new Shader(vert, frag_add,
    [
        "mat_pos", "tex", "tex_dest", "color",
    ]);
    var shader_drying = new Shader(vert, frag_drying,
    [
        "mat_pos", "tex",
    ]);

    const size = 2 << size_class;
    const size_quad = 32;
    var fbo_decals = new Array(size * size);
    var fbo_decal = new Framebuffer(512, 512);
    var fbo_dry = new Framebuffer(512, 512);
    var current_dry_fbo = 0;

    for (var i = 0; i < size * size; i++)
    {
        var x = i % size | 0;
        var y = i / size | 0;
        fbo_decals[i] = 
        {
            fbo: new Framebuffer(512, 512),
            x: x * size_quad | 0,
            y: y * size_quad | 0,
            time: 0,
        };
    }

    function render_base(fbo, shader, texId, dynent, secondId, color)
    {
        fbo.bind()
        shader.use();
        shader.texture(shader.tex, texId, 0);
        if (shader.tex_dest && shader.color)
        {
            shader.texture(shader.tex_dest, secondId, 1);
            shader.vector(shader.color, color);
        }
        
        var mat = mat4.create();
        mat4.scal(mat, [1 / size_quad, 1 / size_quad]);
        
        var mb = mat4.create();
        mat4.trans(mb, [2 * (dynent.pos.x - size_quad / 2), 2 * (-dynent.pos.y + size_quad / 2)]);
        
        var mr = mat4.create();
        mat4.rotateZ(mr, mr, dynent.angle);
        mat4.mul(mb, mb, mr);
        mat4.mul(mat, mat, mb);
        
        mat4.scal(mat, dynent.size.toVec());
        shader.matrix(shader.mat_pos, mat);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        fbo.unbind();
        stats.count_decal++;
    }
    function render_decal_absolute_coord(fbo, dynent, tex, color, sh_add)
    {
        var pos = Vector.sub2(dynent.pos, fbo.x, fbo.y);
        var rad = dynent.size.length() * 0.5;
        if (pos.x + rad < 0) return;
        if (pos.y + rad < 0) return;
        if (pos.x - rad > size_quad) return;
        if (pos.y - rad > size_quad) return;
        if (!tex.getId()) return;

        var blend = gl.isEnabled(gl.BLEND);
        if (blend)
        {
            gl.disable(gl.BLEND);
        }

        var dynent =
        {
            pos: pos,
            size: dynent.size,
            angle: dynent.angle,
        };

        render_base(fbo_decal, shader_blit, fbo.fbo.getTexture(), dynent);
        render_base(fbo.fbo, sh_add ? shader_add : shader_lerp, tex.getId(), dynent, fbo_decal.getTexture(), color);

        if (blend)
        {
            gl.enable(gl.BLEND);
        }
    }
    function drying(fbo)
    {
        if (fbo.time < Date.now())
        {
            var drying_time = Console.variable("drying-time", "time of drying decals", 1000);
            fbo.time = Date.now() + parseInt(drying_time);
            var dest = fbo_dry;
            dest.bind();
            shader_drying.use();
            shader_drying.matrix(shader_drying.mat_pos, mat4.create());
            shader_drying.texture(shader_drying.tex, fbo.fbo.getTexture(), 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);   
            dest.unbind();
            fbo_dry = fbo.fbo;
            fbo.fbo = dest;
            return true;
        }
        return false;
    }

    this.render_decal = function(dynent, tex, color, sh_add)
    {
        fbo_decals.forEach(function(fbo)
        {
            render_decal_absolute_coord(fbo, dynent, tex, color, sh_add);
        });
    }
    this.render = function(camera)
    {
        fbo_decal.bind();
        fbo_decals.forEach(function(fbo)
        {
            var pos = new Vector(fbo.x + size_quad / 2, fbo.y + size_quad / 2);
            Dynent.render(camera, fbo.fbo.getTexture(), LevelRender.shader_simple, pos, [size_quad, size_quad], 0, 
            {
                not_use_visible: true,
            });
        });
        fbo_decal.unbind();
        
        if (drying(fbo_decals[current_dry_fbo]))
        {
            current_dry_fbo++;
            if (current_dry_fbo > fbo_decals.length - 1)
                current_dry_fbo = 0;
        }
    }
    this.getDecalTexture = function()
    {
        return fbo_decal.getTexture();
    }
}

Decal.render_decal = function(dynent, tex, color, sh_add = false)
{
    if (options.highQuality)
    {
        gameClient.getLevelRender().getDecal().render_decal(dynent, tex, color, sh_add);
    }
}

Event.on("cl_botdead", function(pos, dir, id)
{
    var color = Bot.isMutant(id) ? [0, 0.5, 0, 1] : [0.5, 0, 0, 1];
    Decal.render_decal(
    {
        pos: pos,
        size: new Vector(3, 3),
        angle: Math.random() * Math.PI * 2,
    }, Particle.splash_textures[20], color);
});

Event.on("cl_bulletlinecollide", function(bullet, dest, norm_dir)
{
    var radius = [0.4, 1, 0.4];
    Decal.render_decal(
    {
        pos: dest,
        angle: Math.random() * Math.PI * 2,
        size: new Vector(radius[bullet.type], radius[bullet.type]),
    }, Weapon.tex_decal, [0.1, 0.1, 0.1, 1], bullet.type === WEAPON.SHAFT);
});
