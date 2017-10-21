"use strict";

function Shader(vp, fp, names)
{
    function compileShader(prog, type)
    {
        var shader = gl.createShader(type);

        gl.shaderSource(shader, prog);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) 
        {
            console.log(prog);
            assert(false, gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }
    
    var frag = compileShader(fp, gl.FRAGMENT_SHADER);
    var vert = compileShader(vp, gl.VERTEX_SHADER);
    if (!frag || !vert)
        return null;

    var prog = gl.createProgram();
        
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.bindAttribLocation(prog, 0, "position");
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    {
        assert(false, "could not initialise shaders");
        return null;
    }

    if (names)
    {
        var self = this;
        names.forEach(function(name)
        {
            self[name] = gl.getUniformLocation(prog, name);
        });
    }
    
    this.use = function()
    {
        gl.useProgram(prog);
    }
    this.matrix = function(name, mat)
    {
        var loc = typeof name === "string" ? gl.getUniformLocation(prog, name) : name;
        gl.uniformMatrix4fv(loc, false, mat); 
    }
    this.texture = function(name, id, lev)
    {
        var loc = typeof name === "string" ? gl.getUniformLocation(prog, name) : name;
        gl.uniform1i(loc, lev);
        gl.activeTexture(gl.TEXTURE0 + lev);
        gl.bindTexture(gl.TEXTURE_2D, id);
    }
    this.vector = function(name, vec)
    {
        var loc = typeof name === "string" ? gl.getUniformLocation(prog, name) : name;
        gl.uniform4f(loc, vec[0], vec[1], vec[2], vec[3]);
    }
    this.getLocation = function(name)
    {
        return gl.getUniformLocation(prog, name);
    }
}

Shader.vertexShader = function(mat_pos, mat_tex, position)
{
    var vert = "attribute vec4 position;\n";

    if (mat_pos) vert += "uniform mat4 mat_pos;\n";
    if (mat_tex) vert += "uniform mat4 mat_tex;\n";
    vert += "varying vec4 texcoord;\n\
    \n\
    void main()\n\
    {\n";
    if (mat_pos) vert += "gl_Position = mat_pos * position;\n";
    else vert += "gl_Position = position;\n";
    if (mat_tex) vert += "texcoord = mat_tex * position;\n";
    else vert += "texcoord = position * 0.5 + 0.5;\n";
    if (position !== undefined) vert += "texcoord.zw = " + position + ".xy * 0.5 + 0.5;\n";
    vert += "}\n";

    return vert;
}