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
      {WebhookClient} = require('discord.js'),
      config = require('./config.json'),
      pkg = require('./package.json');

/**
 * Constants.
 */
const gotTopic = {},
      webhooks = {},
      RELAY_REGEX = /^(?:\[DISCORD\] )?<([^>]+)> (.*)/;

/**
 * Relays a message to Discord.
 * @param {String} channel IRC channel the message is originating from
 * @param {String} name Webhook's username
 * @param {String} text Text to be posted
 */
function relay(channel, name, text) {
    webhooks[channel].forEach(function(webhook) {
        webhook.send(
            text
                .replace(/@(everyone|here)/g, '@\u200B$1')
                .replace(/discord\.gg/g, 'discord\u200B.gg')
                .replace(/<?(https?:\/\/[^\s>]+)>?/g, '<$1>'),
            {
                username: name.slice(0, 32)
            }
        );
    });
}

/**
 * Initialize webhook configuration.
 */
if (config.channel) {
    webhooks[config.channel] = [new WebhookClient(config.id, config.token)];
} else {
    config.channels.forEach(function(channel) {
        if (!webhooks[channel.name]) {
            webhooks[channel.name] = [];
        }
        webhooks[channel.name].push(
            new WebhookClient(channel.id, channel.token)
        );
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
        channels: config.channel ? [
            config.channel
        ] : Object.keys(webhooks),
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
        if (webhooks[channel]) {
            relay(channel, 'ChanServ', `${nick} changed topic to: *${topic}*`);
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
    } else if (webhooks[channel]) {
        relay(channel, 'ChanServ', `${nick} joined.`);
    } else {
        console.log(`${nick} joined ${channel}.`);
    }
})
.on('part', function(channel, nick, reason) {
    if (webhooks[channel]) {
        if (reason) {
            relay(channel, 'ChanServ', `${nick} left: *${reason}*`);
        } else {
            relay(channel, 'ChanServ', `${nick} left.`);
        }
    } else if (reason) {
        console.log(`${nick} left ${channel}: *${reason}*`);
    } else {
        console.log(`${nick} left ${channel}.`);
    }
})
.on('quit', function(nick, reason, channels) {
    const activeChannels = channels.filter(channel => webhooks[channel]);
    if (activeChannels.length) {
        activeChannels.forEach(function(channel) {
            if (reason) {
                relay(channel, 'ChanServ', `${nick} left: *${reason}*`);
            } else {
                relay(channel, 'ChanServ', `${nick} left.`);
            }
        });
    } else if (reason) {
        console.log(`${nick} quit: "${reason}".`);
    } else {
        console.log(`${nick} quit.`);
    }
})
.on('message', function(nick, to, text) {
    if (webhooks[to]) {
        let user = nick,
            msg = text;
        if (nick.startsWith(config.relay)) {
            const res = RELAY_REGEX.exec(text);
            if (res) {
                user = `${res[1]} [Relay]`;
                msg = res[2];
            }
        }
        relay(to, user, msg);
    } else if (to === bot.nick) {
        console.log(`<${nick}@PM> ${text}`);
    } else {
        console.log(`<${nick}@${to}> ${text}`);
    }
})
.on('action', function(from, to, text) {
    if (webhooks[to]) {
        relay(to, from, `*${text}*`);
    } else {
        console.log(`Action by ${from} in ${to}: ${text}`);
    }
})
.on('kick', function(channel, nick, by, reason) {
    if (webhooks[channel]) {
        if (reason) {
            relay(channel, 'ChanServ', `${by} kick ${nick}: *${reason}*`);
        } else {
            relay(channel, 'ChanServ', `${by} kicked ${nick}.`);
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
    const activeChannels = channels.filter(channel => webhooks[channel]);
    if (nick === bot.nick) {
        if (reason) {
            console.log(`You have been killed from the server: "${reason}".`);
        } else {
            console.log('You have been killed from the server.');
        }
    } else if (activeChannels.length) {
        activeChannels.forEach(function(channel) {
            if (reason) {
                relay(channel, 'ChanServ', `${nick} has been killed: *${reason}*`);
            } else {
                relay(channel, 'ChanServ', `${nick} has been killed.`);
            }
        });
    } else if (reason) {
        console.log(`${nick} has been killed from the server: "${reason}".`);
    } else {
        console.log(`${nick} has been killed from the server.`);
    }
})
.on('nick', function(oldnick, newnick, channels) {
    const msg = `${oldnick} is now known as ${newnick}.`,
          activeChannels = channels.filter(channel => webhooks[channel]);
    if (activeChannels.length) {
        activeChannels.forEach(channel => relay(channel, 'ChanServ', msg));
    } else {
        console.log(msg);
    }
})
.on('+mode', function(channel, by, mode, argument) {
    const msg = `${by} sets mode +${mode} on ${
        argument || (
            webhooks[channel] ?
                'the channel' :
                channel
        )
    }.`;
    if (webhooks[channel]) {
        relay(channel, 'ChanServ', msg);
    } else {
        console.log(msg);
    }
})
.on('-mode', function(channel, by, mode, argument) {
    const msg = `${by} sets mode -${mode} on ${
        argument || (
            webhooks[channel] ?
                'the channel' :
                channel
        )
    }.`;
    if (webhooks[channel]) {
        relay(channel, 'ChanServ', msg);
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
