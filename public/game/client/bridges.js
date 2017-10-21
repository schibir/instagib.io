"use strict";

function BridgesRender(level)
{
    var vert = "\n\
    attribute vec4 position;\n\
    uniform mat4 mat_pos;\n\
    uniform mat4 mat_tex;\n\
    varying vec4 texcoord;\n\
    varying vec4 tc_visible;\n\
    \n\
    void main()\n\
    {\n\
        gl_Position = mat_pos * position;\n\
        texcoord = mat_tex * position;\n\
        texcoord.zw = position.xy * 0.5 + 0.5;\n\
        tc_visible.xy = gl_Position.xy * 0.5 + 0.5;\n\
    }\n";

    var frag = "\n\
    #ifdef GL_ES\n\
    // define default precision for float, vec, mat.\n\
    precision highp float;\n\
    #endif\n\
    \n\
    uniform sampler2D tex;\n\
    uniform sampler2D tex_visible;\n\
    uniform sampler2D tex_mask;\n\
    uniform sampler2D tex_decal;\n\
    varying vec4 texcoord;\n\
    varying vec4 tc_visible;\n\
    \n\
    void main()\n\
    {\n\
        vec4 col = texture2D(tex, texcoord.xy);\n\
        vec4 visible = texture2D(tex_visible, tc_visible.xy);\n\
        vec4 decal = texture2D(tex_decal, tc_visible.xy);\n\
        vec4 mask = texture2D(tex_mask, texcoord.zw);\n\
        float shadow = clamp((1.0 - visible.g) * 6.0 - 3.0, 0.5, 1.0);\n\
        col.rgb = mix(col.rgb, decal.rgb, decal.a);\n\
        col.rgb *= (1.0 - visible.r) * shadow;\n\
        gl_FragColor = col * mask.gggr;\n\
    }\n";

    var texture = new Texture("textures/fx/bridge.jpg");
    var tex_mask = new Texture("textures/fx/bridge_mask.png", { wrap: gl.CLAMP_TO_EDGE });
    var shader = new Shader(vert, frag,
    [
        "mat_pos", "mat_tex", "tex", "tex_visible", "tex_mask", "tex_decal",
    ]);

    this.ready = function()
    {
        return texture.ready() && tex_mask.ready();
    };
    this.render = function(camera, bridges)
    {
        var tex_mask_id = tex_mask.getId();
        if (tex_mask_id === null)
            return;

        bridges.forEach(function(bridge)
        {
            var mat_tex = mat4.create();
            mat4.trans(mat_tex, [0.5, 0.5]);
            mat4.scal(mat_tex, [0.5 * bridge.size.x / bridge.size.y, 0.5]);
            bridge.render(camera, texture, shader,
            {
                mat_tex: mat_tex,
                textures: 
                [
                    {
                        location: shader.tex_mask,
                        id: tex_mask_id,
                    },
                    {
                        location: shader.tex_decal,
                        id: level.getDecal().getDecalTexture(),
                    },
                ],
            });
        });
    };
}