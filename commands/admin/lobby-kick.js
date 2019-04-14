const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');
const convertor = require('steam-id-convertor');
const Db = require('../../lib/db');
const CONSTANTS = require('../../lib/constants');

/**
 * @class LobbyKickCommand
 * @extends IHLCommand
 */
module.exports = class LobbyKickCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'lobby-kick',
            group: 'admin',
            memberName: 'lobby-kick',
            guildOnly: true,
            description: 'Kick a user from a lobby.',
            examples: ['lobby-kick @devilesk'],
            args: [
                {
                    key: 'member',
                    prompt: 'Provide a user to kick.',
                    type: 'member',
                },
            ],
        }, {
            inhouseAdmin: true,
            inhouseState: true,
            lobbyState: true,
            inhouseUser: false,
        });
    }

    async onMsg({ msg, guild, lobbyState }, { member }) {
        const user = await Db.findUserByDiscordId(guild.id)(member.id);
        if (user) {
            await member.removeRole(lobbyState.role);
            const account_id = convertor.to32(user.steamid_64);
            await this.ihlManager[CONSTANTS.EVENT_LOBBY_KICK](lobbyState, account_id);
            await msg.say('User kicked from lobby.');
        }
        else {
            await msg.say('User not found. (Has user registered with `!register`?)');
        }

    }
};
