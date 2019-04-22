const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');
const CONSTANTS = require('../../lib/constants');

/**
 * @class LobbyKillCommand
 * @category Commands
 * @extends IHLCommand
 * @memberof module:ihlCommand
 */
module.exports = class LobbyKillCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'lobby-kill',
            aliases: ['lobby-destroy'],
            group: 'admin',
            memberName: 'lobby-kill',
            guildOnly: true,
            description: 'Kill a lobby.',
        }, {
            inhouseAdmin: true,
            inhouseState: true,
            lobbyState: true,
            inhouseUser: false,
        });
    }

    async onMsg({ msg, inhouseState, lobbyState }) {
        await msg.say('Killing lobby...');
        await this.ihlManager[CONSTANTS.EVENT_LOBBY_KILL](lobbyState, inhouseState);
    }
};
