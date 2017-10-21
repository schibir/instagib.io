"use strict";

var words = require("./dict").english_words;

function NickGenerator(max_prefix)
{
    function Node(ch)
    {
        var self = this;
        this.ch = ch;
        this.count = 0;

        this.getRandomChild = function()
        {
            var counts = 0;
            var chars = [];
            for (var prop in self)
            {
                if (self[prop] instanceof Node)
                {
                    chars.push(prop);
                    counts += self[prop].count;
                }
            }
            var char;
            while (counts > 0)
            {
                var id = Math.random() * chars.length | 0;
                char = chars[id];
                counts -= self[char].count;
            }
            return char ? self[char] : null;
        };
        this.getRandomCommonChild = function(node)
        {
            var counts = 0;
            var chars = [];
            for (var prop in self)
            {
                if (self[prop] instanceof Node && node[prop] !== undefined)
                {
                    var count = self[prop].count * node[prop].count;
                    chars.push({ char: prop, count: count });
                    counts += count;
                }
            }
            var char;
            while (counts > 0)
            {
                var id = Math.random() * chars.length | 0;
                char = chars[id];
                counts -= char.count;
            }
            if (!char)
                return null;
            var ret =
            {
                char: char.char,
                first: self[char.char],
                second: node[char.char],
            };
            return ret;
        };
    }

    function Tree()
    {
        var self = this;
        this.head = new Node();

        this.addWord = function(word)
        {
            var cur = self.head;
            for (var i = 0; i < word.length; i++)
            {
                var ch = word[i];
                if (cur[ch] === undefined)
                {
                    cur[ch] = new Node(ch);
                }
                cur = cur[ch];
                cur.count++;
            }
        };
    }

    const MAX_LENGTH = max_prefix || 3;
    if (MAX_LENGTH < 3 || MAX_LENGTH > 5)
    {
        throw new Error("too many length");
    }

    var prefix = new Tree();
    words.forEach(function(word)
    {
        prefix.addWord(word.substr(0, MAX_LENGTH));
    });

    var suffix = new Tree();
    words.forEach(function(word)
    {
        suffix.addWord(word.slice(-MAX_LENGTH));
    });

    var subword = new Tree();
    words.forEach(function(word)
    {
        for (var i = 0; i < word.length - MAX_LENGTH + 1; i++)
        {
            subword.addWord(word.substr(i, MAX_LENGTH));
        }
    });

    this.gener = function(length)
    {
        var nick = "";
        var prefix_node = prefix.head;

        var only_prefix_length = Math.max(Math.min(MAX_LENGTH, length - MAX_LENGTH), 0);

        for (let i = 0; i < only_prefix_length; i++)
        {
            let node = prefix_node.getRandomChild();
            if (!node) return nick;
            nick += node.ch;
            prefix_node = node;
        }

        var suffix_node = suffix.head;

        for (let i = only_prefix_length; i < Math.min(MAX_LENGTH, length); i++)
        {
            let pair = prefix_node.getRandomCommonChild(suffix_node);
            if (!pair) return nick;
            nick += pair.char;
            prefix_node = pair.first;
            suffix_node = pair.second;
        }

        function subwordNode()
        {
            var last = nick.slice(-MAX_LENGTH + 1);
            var ret = subword.head;
            for (var i = 0; i < last.length; i++)
            {
                var char = last[i];
                if (ret[char]) ret = ret[char];
                else return null;
            }
            return ret;
        }

        for (let i = Math.min(MAX_LENGTH, length); i < Math.min(length - MAX_LENGTH + 1, length); i++)
        {
            let node = subwordNode();
            if (!node) return nick;
            node = node.getRandomChild();
            if (!node) return nick;
            nick += node.ch;
        }

        while (nick.length < length)
        {
            let node = subwordNode();
            if (!node) return nick;
            let pair = suffix_node.getRandomCommonChild(node);
            if (!pair) return nick;
            nick += pair.char;
            suffix_node = pair.first;
        }

        return nick;
    };
};

exports.NickGenerator = NickGenerator;
