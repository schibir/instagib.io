"use strict";

var Event =
{
    events: [],
};

Event.on = function(event_name, callback)
{
    if (!this.events[event_name])
    {
        this.events[event_name] = [];
    }
    this.events[event_name].push(
    {
        callback: callback,
    });
    if (this.events[event_name].length > 10)
        throw new Error("too many listeners");
};

Event.emit = function(event_name, ...param)
{
    var event = this.events[event_name];
    if (event && event.length > 0)
    {
        for (var i = 0; i < event.length; i++)
            event[i].callback(...param);
    }
};

exports.Event = Event;