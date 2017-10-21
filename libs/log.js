"use strict";

var winston = require("winston");
var fs = require("fs");

function getLogger(module)
{
    var path = module.filename.split('/').slice(-2).join('/');

    var ret = new winston.Logger(
    {
        transports:
        [
            new winston.transports.Console(
            {
                colorize: true,
                level: "debug",
                label: path,
            }),
        ],
    });

    ret.assert = function(condition, message)
    {
        if (!condition)
        {
            message = message || "Assertion failed";
            ret.error(message);
            if (typeof Error !== "undefined")
            {
                throw new Error(message);
            }
            throw message; // Fallback
        }
    };

    ret.html = function(str)
    {
        try
        {
            const log_name = "./public/log/index.html";
            const exist = fs.existsSync(log_name);
            if (!exist)
            {
                fs.mkdirSync("./public/log");
                const head = "\
                    <html>\
                    <head>\
                    <meta http-equiv='Content-Type' content='text/html; charset=utf-8'>\
                    <title>instagib.io</title>\
                    <body>";
                fs.appendFileSync(log_name, head);
            }
            const msg = "<div>" + str + " <font color='blue'>" + Date() + "</font></div>";
            fs.appendFileSync(log_name, msg);
        }
        catch (err)
        {
            ret.error("write to html error:", err);
        }
    };

    return ret;
}

module.exports = getLogger;