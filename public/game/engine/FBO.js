"use strict";

function Framebuffer(width, height)
{
    var id = gl.createFramebuffer();
    var tex = gl.createTexture();

    // init texture
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    //non-multisample, so bind things directly to the FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, id);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var ret = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (ret !== gl.FRAMEBUFFER_COMPLETE)
    {
        assert(false, "ERROR: checkFramebufferStatus " + ret);
        return null;
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    this.bind = function()
    {
        assert(id);
        gl.viewport(0, 0, width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, id);
    }
    this.unbind = function()
    {
        assert(id);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.getTexture = function()
    {
        return tex;
    }
}