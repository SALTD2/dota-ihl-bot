const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');
const { findUser } = require('../../lib/ihlManager');
const Db = require('../../lib/db');
const Lobby = require('../../lib/lobby');

/**
 * @class UncommendCommand
 * @extends IHLCommand
 */
module.exports = class UncommendCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'uncommend',
            group: 'ihl',
            memberName: 'uncommend',
            guildOnly: true,
            description: 'Uncommend a player.',
            examples: ['uncommend @Ari*', 'uncommend Sasquatch'],
            args: [
                {
                    key: 'member',
                    prompt: 'Provide a player name or mention.',
                    type: 'string',
                },
                {
                    key: 'match_id',
                    prompt: 'Provide a match id.',
                    type: 'string',
                },
            ],
        }, { lobbyState: false });
    }

    async onMsg({ msg, guild, inhouseUser }, { member, match_id }) {
        const [user, discordUser] = await findUser(guild)(member);
        const fromUser = inhouseUser;
        const lobby = await Db.findLobbyByMatchId(match_id);
        const players = await Lobby.getPlayers()(lobby);
        if (lobby) {
            if (user && fromUser) {
                if (players.find(player => player.id === user.id) && players.find(player => player.id === fromUser.id)) {
                    if (user.id !== fromUser.id) {
                        const count = await Db.destroyCommend(lobby)(fromUser)(user);
                        logger.silly(count);
                        if (count) {
                            return msg.say(`${msg.author.username} uncommends ${discordUser.displayName}.`);
                        }
                        return msg.say(`${discordUser.displayName} not commended.`);
                    }
                    return msg.say('Cannot uncommend yourself.');
                }
            }
            return msg.say(IHLCommand.UserNotFoundMessage);
        }
        return msg.say(`Match ${match_id} not found.`);
    }
};
