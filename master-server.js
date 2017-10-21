"use strict";

var express = require("express");
var http = require("http");
var path = require("path");
var logger = require('morgan');
var bodyParser = require('body-parser');
var fs = require("fs");

var config = require("config");
var log = require("libs/log")(module);
var net_server = require("./net-server");

var app = express();
var router = express.Router();

// view engine setup
app.engine("ejs", require("ejs-locals"));   
app.set("views", path.join(__dirname, "templates"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use('/', router);

/* GET home page. */
router.get('/', function(req, res, next)
{
    res.render("index");
});

router.use("/common", function(req, res, next)
{
    var game_server = path.join(__dirname, "game-server");
    var room = path.join(game_server, "room");
    var common = path.join(room, "common");
    var filename = path.join(common, req.url);

    fs.exists(filename, function(exists)
    {
        function error(status, message)
        {
            res.writeHead(status, {"Content-Type": "text/plain"});
            res.write(message);
            res.end();
        }

        if (!exists) return error(404, "404 Not Found\n");

        fs.readFile(filename, "binary", function(err, file)
        {
            if (err) return error(500, err + "\n");
    
            if (path.extname(filename) === ".js")
            {
                res.writeHead(200, {"Content-Type": "text/javascript"});
                res.write(file, "binary");
                res.end();
            }
            else return error(403, "Access denied");
        });
    });
});

router.post("/login", function(req, res, next)
{
    var nick = req.body.nick;
    log.debug("login for " + nick);

    net_server.getGameAddr(function(addr)
    {
        log.html("New user " + nick + " addr = '" + addr + "'");
        var param = addr === "" ? "&local=true&addr=local" : "&local=false&addr=" + addr;
        // To Write a Cookie
        res.writeHead(200,
        {
            "Set-Cookie": "nick=" + encodeURI(nick) + param + "; Max-Age=5",
        });
        res.end("/game");
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next)
{
    var err = new Error("Page not found");
    err.status = 404;
    log.error(req.url, " not found");
    next(err);
});

// error handler
app.use(function(err, req, res, next)
{
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = err;

    // render the error page
    res.status(err.status || 500);
    res.render("error");
});

http.createServer(app).listen(config.get("master-server:port"), function()
{
    log.info("Ok, ", config.get("master-server:port"));
});

