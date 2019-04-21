const logger = require('../../lib/logger');
const IHLCommand = require('../../lib/ihlCommand');
const Db = require('../../lib/db');
const convertor = require('steam-id-convertor');
const CONSTANTS = require('../../lib/constants');
const { findUser } = require('../../lib/ihlManager');

const RANK_TO_MEDAL = {
    80: 'Immortal',
    70: 'Divine',
    60: 'Ancient',
    50: 'Legend',
    40: 'Archon',
    30: 'Crusader',
    20: 'Guardian',
    10: 'Herald',
    0: 'Uncalibrated',
};

const rankTierToMedalName = (_rankTier) => {
    logger.silly(`rankTierToMedalName ${_rankTier}`);
    const rankTier = _rankTier || 0;
    const rank = Math.floor(rankTier / 10) * 10;
    const tier = rankTier % 10;
    logger.silly(`rankTierToMedalName ${rank} ${tier}`);
    let medal = 'Unknown';
    if (rank >= 0 && rank < 90) {
        medal = `${RANK_TO_MEDAL[rank]}`;
        if (rank !== 80 && rank > 0 && tier > 0) {
            medal += ` ${tier}`;
        }
    }
    return medal;
};

/**
 * @class WhoisCommand
 * @extends IHLCommand
 */
module.exports = class WhoisCommand extends IHLCommand {
    constructor(client) {
        super(client, {
            name: 'whois',
            aliases: ['who', 'info', 'stats', 'lookup'],
            group: 'ihl',
            memberName: 'whois',
            guildOnly: true,
            description: 'Look up inhouse player information.',
            examples: ['whois @Ari*', 'whois Sasquatch'],
            args: [
                {
                    key: 'member',
                    prompt: 'Provide a player name or mention.',
                    type: 'string',
                },
            ],
        }, {
            lobbyState: false,
            inhouseUser: false,
        });
    }

    async onMsg({ msg, league, guild }, { member }) {
        let wins = 0;
        let losses = 0;

        const [user, discordUser, result_type] = await findUser(guild)(member);

        let footerText;
        switch (result_type) {
        case CONSTANTS.MATCH_EXACT_DISCORD_MENTION:
            footerText = `Exact match for ${discordUser.displayName} by discord mention`;
            break;
        case CONSTANTS.MATCH_EXACT_DISCORD_NAME:
            footerText = `Exact match for ${member} by discord name`;
            break;
        case CONSTANTS.MATCH_STEAMID_64:
            footerText = `Parsed steam id for ${discordUser.displayName}`;
            break;
        case CONSTANTS.MATCH_EXACT_NICKNAME:
            footerText = `Exact match for ${member} by nickname`;
            break;
        case CONSTANTS.MATCH_CLOSEST_NICKNAME:
            footerText = `Closest match for ${member} by nickname`;
            break;
        default:
            footerText = '';
        }

        if (user) {
            logger.silly(user.nickname);

            let roles = [];
            for (let i = 1; i <= 5; i++) {
                logger.silly(user[`role_${i}`]);
                roles.push([i, user[`role_${i}`]]);
            }
            logger.silly(roles);
            roles = roles.filter(([, pref]) => pref !== -1).sort(([, p1], [, p2]) => p1 - p2).map(([r]) => r);
            const account_id = convertor.to32(user.steamid_64);

            const [leaderboard] = await user.getLeaderboards({ where: { season_id: league.current_season_id } });
            logger.silly(leaderboard);
            if (leaderboard) {
                wins = leaderboard.wins;
                losses = leaderboard.losses;
            }
            const rep = (await user.getReputationsReceived()).length;
            const commends = (await user.getCommendsReceived()).length;

            const rank = await Db.queryUserLeaderboardRank(league.id)(league.current_season_id)(user.id);

            logger.silly(`rank ${rank}`);

            await msg.channel.send({
                embed: {
                    color: 100000,
                    fields: [
                        {
                            name: 'Discord',
                            value: `${discordUser.user.username}#${discordUser.user.discriminator}`,
                            inline: true,
                        },
                        {
                            name: 'Nickname',
                            value: user.nickname || 'N/A',
                            inline: true,
                        },
                        {
                            name: 'Medal',
                            value: rankTierToMedalName(user.rank_tier),
                            inline: true,
                        },
                        {
                            name: 'IH Rating',
                            value: leaderboard ? leaderboard.rating : 'N/A',
                            inline: true,
                        },
                        {
                            name: 'Rank',
                            value: rank || 'N/A',
                            inline: true,
                        },
                        {
                            name: 'Roles',
                            value: roles.join(',') || 'N/A',
                            inline: true,
                        },
                        {
                            name: 'Rep/Commends',
                            value: `${rep}/${commends}`,
                            inline: true,
                        },
                        {
                            name: 'Win-Loss',
                            value: `${wins}-${losses}`,
                            inline: true,
                        },
                        {
                            name: 'Preferred Mode',
                            value: `${user.game_mode_preference.replace('DOTA_GAMEMODE_', '')}`,
                            inline: true,
                        },
                        {
                            name: 'Vouched',
                            value: `${user.vouched}`,
                            inline: true,
                        },
                        {
                            name: 'Queue Timeout',
                            value: Date.now() < user.queue_timeout ? user.queue_timeout : null,
                            inline: true,
                        },
                        {
                            name: 'Links',
                            value: `[DB](https://www.dotabuff.com/players/${account_id})/[OD](https://www.opendota.com/players/${account_id})/[SZ](https://stratz.com/en-us/player/${account_id})/[Steam](http://steamcommunity.com/profiles/${user.steamid_64})`,
                            inline: true,
                        },
                    ].filter(field => field.value !== null),
                    footer: { text: footerText },
                },
            });
        }
        else {
            await msg.say(`${member} not found.`);
        }
    }
};
