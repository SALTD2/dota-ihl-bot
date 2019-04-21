const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');
const CONSTANTS = require('../../lib/constants');

/**
 * @class GameModeCommand
 * @extends IHLCommand
 */
module.exports = class GameModeCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'gamemode',
            group: 'ihl',
            memberName: 'gamemode',
            guildOnly: true,
            description: 'Set your game mode preference.',
            examples: ['gamemode cm', 'gamemode cd'],
            args: [
                {
                    key: 'text',
                    prompt: 'Provide a gamemode "cm" or "cd".',
                    type: 'string',
                    validate: (text) => {
                        if (text === 'cm' || text === 'cd') return true;
                        return 'Game mode must be "cm" or "cd".';
                    },
                },
            ],
        }, {
            lobbyState: false,
            inhouseUserVouched: false,
        });
    }

    async onMsg({ msg, inhouseUser }, { text }) {
        const gameMode = text === 'cm' ? CONSTANTS.DOTA_GAMEMODE_CM : CONSTANTS.DOTA_GAMEMODE_CD;
        await inhouseUser.update({ gameModePreference: gameMode });
        return msg.say(`Preferred game mode set to ${text === 'cm' ? "Captain's Mode" : "Captain's Draft"}.`);
    }
};
