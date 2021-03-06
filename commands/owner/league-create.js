const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');

/**
 * @class LeagueCreateCommand
 * @category Commands
 * @extends IHLCommand
 * @memberof module:ihlCommand
 */
module.exports = class LeagueCreateCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'league-create',
            group: 'owner',
            memberName: 'league-create',
            guildOnly: true,
            description: 'Create an inhouse league for the server.',
        }, {
            clientOwner: true,
            inhouseAdmin: false,
            inhouseState: false,
            lobbyState: false,
            inhouseUser: false,
        });
    }

    async onMsg({ msg, inhouseState, guild }) {
        if (!inhouseState) {
            await this.ihlManager.createNewLeague(guild);
            return msg.say('Inhouse league created.');
        }
        return msg.say('Inhouse league already exists.');
    }
};
