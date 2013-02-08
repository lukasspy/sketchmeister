(function () {

    // mini json.
    if (!this.JSON) {
        JSON = function () {
            function f(n) {
                return n < 10 ? '0' + n : n;
            }
            Date.prototype.toJSON = function () {
                return this.getUTCFullYear() + '-' + f(this.getUTCMonth() + 1) + '-' + f(this.getUTCDate()) + 'T' + f(this.getUTCHours()) + ':' + f(this.getUTCMinutes()) + ':' + f(this.getUTCSeconds()) + 'Z';
            };
            var m = {
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };

            function stringify(value, whitelist) {
                var a, i, k, l, r = /["\\\x00-\x1f\x7f-\x9f]/g,
                    v;
                switch (typeof value) {
                case 'string':
                    return r.test(value) ? '"' + value.replace(r, function (a) {
                        var c = m[a];
                        if (c) {
                            return c;
                        }
                        c = a.charCodeAt();
                        return '\\u00' + Math.floor(c / 16).toString(16) + (c % 16).toString(16);
                    }) + '"' : '"' + value + '"';
                case 'number':
                    return isFinite(value) ? String(value) : 'null';
                case 'boolean':
                case 'null':
                    return String(value);
                case 'object':
                    if (!value) {
                        return 'null';
                    }
                    if (typeof value.toJSON === 'function') {
                        return stringify(value.toJSON());
                    }
                    a = [];
                    if (typeof value.length === 'number' && !(value.propertyIsEnumerable('length'))) {
                        l = value.length;
                        for (i = 0; i < l; i += 1) {
                            a.push(stringify(value[i], whitelist) || 'null');
                        }
                        return '[' + a.join(',') + ']';
                    }
                    if (whitelist) {
                        l = whitelist.length;
                        for (i = 0; i < l; i += 1) {
                            k = whitelist[i];
                            if (typeof k === 'string') {
                                v = stringify(value[k], whitelist);
                                if (v) {
                                    a.push(stringify(k) + ':' + v);
                                }
                            }
                        }
                    } else {
                        for (k in value) {
                            if (typeof k === 'string') {
                                v = stringify(value[k], whitelist);
                                if (v) {
                                    a.push(stringify(k) + ':' + v);
                                }
                            }
                        }
                    }
                    return '{' + a.join(',') + '}';
                }
            }
            return {
                stringify: stringify,
                parse: function (text, filter) {
                    var j;

                    function walk(k, v) {
                        var i, n;
                        if (v && typeof v === 'object') {
                            for (i in v) {
                                if (Object.prototype.hasOwnProperty.apply(v, [i])) {
                                    n = walk(i, v[i]);
                                    if (n !== undefined) {
                                        v[i] = n;
                                    }
                                }
                            }
                        }
                        return filter(k, v);
                    }
                    if (/^[\],:{}\s]*$/.test(text.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
                        j = eval('(' + text + ')');
                        return typeof filter === 'function' ? walk('', j) : j;
                    }
                    throw new SyntaxError('parseJSON');
                }
            };
        }();
    }

    // The script location
    var ScriptSrc = (function () {
        var src;
        var i;
        var scripts = document.getElementsByTagName('script'),
            script = scripts[scripts.length - 1];

        if (script.getAttribute.length !== undefined) {
            src = script.src;
        } else {
            src = script.getAttribute('src', -1);
        }

        return src;
    }());

    // Splits the hash string at the end of the script location.
    function splitHashString(b) {

        var a = {};

        var c = b.split("#");
        var fields = c[c.length - 1].split("&");

        for (var f = 0; f < fields.length; f++) {
            var i = fields[f].split("=");

            if (i[0]) {

                try {
                    if (i.length > 1) {
                        if (window.decodeURIComponent) {
                            a[i[0].toLowerCase()] = decodeURIComponent(i[1].replace(/\+/g, " "));
                        } else {
                            a[i[0].toLowerCase()] = unescape(i[1]);
                        }
                    } else {
                        a[i[0].toLowerCase()] = "";
                    }
                } catch (except) {

                }

            }
        }

        return a;
    }

    /** @contructor */
    // The messenger object handles bi-directional communication between the main
    // window and an iframe. It will also queue messages until the iframe has
    // finished loading and sends the ready signal.
    function Messenger(targetFrame, targetDomain, prefix) {
        this.init(targetFrame, targetDomain, prefix);
    }

    Messenger.prototype = {
        init: function (targetFrame, targetDomain, prefix) {
            // The DOM node of the target iframe.
            this.targetFrame = targetFrame;

            // The domain, including http:// of the target iframe.
            this.targetDomain = targetDomain;

            // A prefix used for distinguishing multiple instances of this script.
            this.prefix = prefix;

            // A map from ticket number strings to functions awaiting replies. The
            // tickets include the prefix so we don't get confused with multiple
            // instances of the iframe.
            this.replies = {};
            this.nextTicket = 0;

            // Until the "ready" signal is received, all messages for the iframe go
            // into this queue.
            this.ready = false;
            this.queue = [];

            var self = this;
            window.addEventListener("message", function (e) {
                self.receive(e);
            }, false);
        },

        send: function (functionName, args, replyFn) {
            var ticket = "ticket_" + this.prefix + "_" + (this.nextTicket++);
            var text = JSON.stringify({
                "function": functionName,
                "args": args,
                "ticket": ticket
            });

            if (replyFn) {
                this.replies[ticket] = replyFn;
            }

            this.sendInternal(text);
        },

        receive: function (e) {
            if (e.origin !== this.targetDomain) {
                // not for us: ignore.
                return;
            }

            var json;

            try {
                json = JSON.parse(e.data);
            } catch (except) {
                alert("Syntax error in response from " + e.origin + ": " + e.data);
                return;
            }

            if (json["event"] === "ready") {
                this.ready = true;
                this.sendQueuedEvents();
                return;
            }

            if (!(json["ticket"] in this.replies)) {
                // no reply ticket.
                return;
            }

            var replyFn = this.replies[json["ticket"]];
            delete this.replies[json["ticket"]];

            var args = [];
            if ("args" in json) {
                args = json["args"];
            }

            replyFn.apply(undefined, args);
        },

        sendInternal: function (text) {
            if (this.ready) {
                this.targetFrame.contentWindow.postMessage(text, this.targetDomain);
            } else {
                this.queue.push(text);
            }
        },

        sendQueuedEvents: function () {

            for (var i = 0; i < this.queue.length; i++) {
                this.targetFrame.contentWindow.postMessage(this.queue[i],
                this.targetDomain);
            }
            this.queue.length = 0;
        }
    };

    // Figure out our desired width from the script URL.
    var hash = splitHashString(ScriptSrc);
    var width = 512;
    var height = 512;
    if ("width" in hash) {
        width = parseInt(hash["width"], 10);
    }
    if ("height" in hash) {
        height = parseInt(hash["height"], 10);
    }

    if (!("ZwibblerInstances" in window)) {
        window["ZwibblerInstances"] = 0;
    }

    // Create an iframe to contain the target web site and insert it before this
    // script tag.
    var id = window.ZwibblerInstances++;
    var iframe = document.createElement("iframe");

    iframe.id = "zwibbler" + id;
    iframe.src = "http://zwibbler.com/#component=1.0";
    iframe.width = width;
    iframe.height = height;
    iframe.style.border = "0";

    var scripts = document.getElementsByTagName('script');
    var ScriptNode = scripts[scripts.length - 1];
    ScriptNode.parentNode.insertBefore(iframe, ScriptNode);


    var messenger = new Messenger(iframe, "http://zwibbler.com", "" + id);

    // create the zwibbler object. Multiple instances do not work yet.
    this["zwibbler"] = {
        "saveToString": function (replyFn) {
            messenger.send("saveToString", {}, replyFn);
        },

        "loadFromString": function (sourceText, replyFn) {
            messenger.send("loadFromString", {
                "sourceText": sourceText
            }, replyFn);
        },

        "saveToTemporaryFile": function (type, replyFn) {
            messenger.send("saveToTemporaryFile", {
                "type": type
            }, replyFn);
        },

        "hide": function () {
            iframe.style.display = "none";
        },

        "show": function () {
            iframe.style.display = "block";
        },

        "getFrame": function () {
            return iframe;
        }
    };


}());