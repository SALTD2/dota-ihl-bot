const IHLCommand = require('../../lib/ihlCommand');
const CONSTANTS = require('../../lib/constants');

/**
 * @class LobbyStartCommand
 * @extends IHLCommand
 */
module.exports = class LobbyStartCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'lobby-start',
            group: 'admin',
            memberName: 'lobby-start',
            guildOnly: true,
            description: 'Start a lobby.',
        }, {
            inhouseAdmin: true,
            inhouseState: true,
            lobbyState: true,
            inhouseUser: false,
        });
    }

    async onMsg({ msg, lobbyState }) {
        this.ihlManager.eventEmitter.emit(CONSTANTS.EVENT_LOBBY_START, lobbyState);
        await msg.say('Lobby started.');
    }
};
