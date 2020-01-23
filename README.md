# IRCLog
Very simple IRC -> Discord relay. Intended for relaying activity from the `#wikia-vstf` channel on Freenode, as a replacement for [CVNAdvanced](https://github.com/KockaAdmiralac/CVNAdvanced)'s logging functionality.

## Installation
To set up the dependencies, run:
```console
$ npm install
```
Afterwards, copy `config.sample.json` to `config.json` and edit options as documented below.

## Configuration
Configuration options are stored in JSON format, and here are their meanings:
- `host`: IRC server host.
- `port`: IRC server port.
- `nick`: IRC bot's nickname.
- `username`: IRC bot's username.
- `password`: IRC bot's IRC password.
- `channels`: Channels the bot should be relaying. Represents an array of objects with the following properties:
    - `name`: Name of the channel to relay.
    - `id`: ID of the Discord webhook to relay activity to.
    - `token`: Token of the Discord  webhook to relay activity to.
- `realname`: IRC bot's realname.
- `relay`: A bot representing another relay.
- `leave`: Message shown to other users when leaving (CTRL+C).

## Running
To run the bot, run:
```console
$ npm start
```
