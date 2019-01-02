/**
 * main.js
 *
 * Main script.
 */
'use strict';

/**
 * Importing modules.
 */
const {Client} = require('irc-upd'),
      http = require('request-promise-native'),
      config = require('./config.json'),
      pkg = require('./package.json');

/**
 * Constants.
 */
const gotTopic = {},
      RELAY_REGEX = /^<([^>]+)> (.*)/;

/**
 * Relays a message to Discord.
 * @param {String} name Webhook's username
 * @param {String} text Text to be posted
 */
function relay(name, text) {
    http({
        body: {
            content: text
                .replace(/@(everyone|here)/g, '@\u200B$1')
                .replace(/discord\.gg/g, 'discord\u200B.gg')
                .replace(/<?(https?:\/\/[^\s>]+)>?/g, '<$1>'),
            username: name.slice(0, 32)
        },
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': `${pkg.name} v${pkg.version} (via webhooks)`
        },
        json: true,
        method: 'POST',
        uri: `https://discordapp.com/api/webhooks/${config.id}/${config.token}`
    }).catch(function(e) {
        console.error('E.', e);
    });
}

/**
 * Initialize the bot.
 */
const bot = new Client(
    config.host,
    config.nick,
    {
        autoConnect: false,
        autoRejoin: true,
        autoRenick: true,
        channels: [
            config.channel
        ],
        password: config.password,
        port: config.port,
        realName: config.realname,
        sasl: true,
        secure: true,
        stripColors: true,
        userName: config.username
    }
)
.on('registered', function() {
    console.log('Registered to server.');
})
.on('topic', function(channel, topic, nick) {
    if (gotTopic[channel]) {
        if (channel === config.channel) {
            relay('ChanServ', `${nick} changed topic to: *${topic}*`);
        } else {
            console.log(`${nick} changed topic of ${channel} to "${topic}".`);
        }
    } else {
        gotTopic[channel] = true;
    }
})
.on('notice', function(nick, to, text) {
    if (to === bot.nick || to === '*') {
        console.log(`Notice from ${nick || 'the server'}: ${text}`);
    } else {
        console.log(`Notice from ${nick} to ${to}: ${text}`);
    }
})
.on('join', function(channel, nick) {
    if (nick === bot.nick) {
        console.log(`Joined ${channel}.`);
    } else if (channel === config.channel) {
        relay('ChanServ', `${nick} joined.`);
    } else {
        console.log(`${nick} joined ${channel}.`);
    }
})
.on('part', function(channel, nick, reason) {
    if (channel === config.channel) {
        if (reason) {
            relay('ChanServ', `${nick} left: *${reason}*`);
        } else {
            relay('ChanServ', `${nick} left.`);
        }
    } else if (reason) {
        console.log(`${nick} left ${channel}: *${reason}*`);
    } else {
        console.log(`${nick} left ${channel}.`);
    }
})
.on('quit', function(nick, reason, channels) {
    if (channels.include(config.channel)) {
        if (reason) {
            relay('ChanServ', `${nick} left: *${reason}*`);
        } else {
            relay('ChanServ', `${nick} left.`);
        }
    } else if (reason) {
        console.log(`${nick} quit: "${reason}".`);
    } else {
        console.log(`${nick} quit.`);
    }
})
.on('message', function(nick, to, text) {
    if (to === config.channel) {
        let user = nick,
            msg = text;
        if (nick === config.relay) {
            const res = RELAY_REGEX.exec(text);
            if (res) {
                user = `${res[1]} [Relay]`;
                msg = res[2];
            }
        }
        relay(user, msg);
    } else if (to === bot.nick) {
        console.log(`<${nick}@PM> ${text}`);
    } else {
        console.log(`<${nick}@${to}> ${text}`);
    }
})
.on('action', function(from, to, text) {
    if (to === config.channel) {
        relay(from, `*${text}*`);
    } else {
        console.log(`Action by ${from} in ${to}: ${text}`);
    }
})
.on('kick', function(channel, nick, by, reason) {
    if (channel === config.channel) {
        if (reason) {
            relay('ChanServ', `${by} kick ${nick}: *${reason}*`);
        } else {
            relay('ChanServ', `${by} kicked ${nick}.`);
        }
        if (nick === bot.nick) {
            delete gotTopic[channel];
        }
    } else if (reason) {
        console.log(`${by} kicked ${nick} from ${channel}: "${reason}".`);
    } else {
        console.log(`${by} kicked ${nick} from ${channel}.`);
    }
})
.on('kill', function(nick, reason, channels) {
    if (nick === bot.nick) {
        if (reason) {
            console.log(`You have been killed from the server: "${reason}".`);
        } else {
            console.log('You have been killed from the server.');
        }
    } else if (channels.includes(config.channel)) {
        if (reason) {
            relay('ChanServ', `${nick} has been killed: *${reason}*`);
        } else {
            relay('ChanServ', `${nick} has been killed.`);
        }
    } else if (reason) {
        console.log(`${nick} has been killed from the server: "${reason}".`);
    } else {
        console.log(`${nick} has been killed from the server.`);
    }
})
.on('nick', function(oldnick, newnick, channels) {
    const msg = `${oldnick} is now known as ${newnick}.`;
    if (channels.includes(config.channel)) {
        relay('ChanServ', msg);
    } else {
        console.log(msg);
    }
})
.on('+mode', function(channel, by, mode, argument) {
    const msg = `${by} sets mode +${mode} on ${
        argument || (
            channel === config.channel ?
                'the channel' :
                channel
        )
    }.`;
    if (channel === config.channel) {
        relay('ChanServ', msg);
    } else {
        console.log(msg);
    }
})
.on('-mode', function(channel, by, mode, argument) {
    const msg = `${by} sets mode -${mode} on ${
        argument || (
            channel === config.channel ?
                'the channel' :
                channel
        )
    }.`;
    if (channel === config.channel) {
        relay('ChanServ', msg);
    } else {
        console.log(msg);
    }
})
.on('ctcp-version', function(from, to) {
    if (to === bot.nick) {
        bot.notice(from, `VERSION ${pkg.name} v${pkg.version}`);
    } else {
        console.log(`${from} sent a CTCP VERSION to ${to}.`);
    }
})
.on('invite', function(channel, from) {
    console.log(`${from} sent an invite to ${channel}.`);
})
.on('error', function(message) {
    console.error('An IRC error occurred:', message);
})
.on('netError', function(exception) {
    console.error('A socket error occurred:', exception);
});

/**
 * Handle CTRL+C.
 */
process.on('SIGINT', function() {
    bot.disconnect(config.leave);
});

/**
 * Connect to IRC.
 */
bot.connect();
