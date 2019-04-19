/**
 * @module matchTracker
 */

const { EventEmitter } = require('events');
const got = require('got');
const convertor = require('steam-id-convertor');
const heroes = require('dotaconstants/build/heroes.json');
const logger = require('./logger');
const CONSTANTS = require('./constants');
const Lobby = require('./lobby');
const Db = require('./db');

const calcEloChange = (r1, r2, K, S) => {
    const E = 1 / (1 + (10 ** ((r2 - r1) / 400)));
    return K * (S - E);
}

const updatePlayerRatings = async (lobbyState) => {
    const lobby = await Lobby.getLobby(lobbyState);
    const league = await Db.findLeagueById(lobby.league_id);
    const faction1 = await Lobby.getFaction1Players()(lobby);
    const faction2 = await Lobby.getFaction2Players()(lobby);
    const r1 = faction1.reduce((total, player) => total + player.rating, 0) / faction1.length;
    const r2 = faction2.reduce((total, player) => total + player.rating, 0) / faction2.length;
    const K = league.elo_k_factor;
    const S1 = lobby.winner === 1 ? 1 : 0;
    const S2 = lobby.winner === 2 ? 1 : 0;
    const D1 = Math.round(calcEloChange(r1, r2, K, S1));
    const D2 = Math.round(calcEloChange(r2, r1, K, S2));
    logger.silly(`updatePlayerRatings ${lobby.winner}`);
    logger.silly(`updatePlayerRatings ${r1} ${S1} ${D1}`);
    logger.silly(`updatePlayerRatings ${r2} ${S2} ${D2}`);
    for (const player of faction1) {
        await Lobby.updateLobbyPlayer({ rating_diff: D1 })(lobby)(player.id);
        await Db.updateUserRating(player)(player.rating + D1);
        const leaderboard = await Db.findOrCreateLeaderboard(lobby)(player)(player.rating + D1);
        await Db.incrementLeaderboardRecord(S1)(S2)(leaderboard);
    }
    for (const player of faction2) {
        await Lobby.updateLobbyPlayer({ rating_diff: D2 })(lobby)(player.id);
        await Db.updateUserRating(player)(player.rating + D2);
        const leaderboard = await Db.findOrCreateLeaderboard(lobby)(player)(player.rating + D1);
        await Db.incrementLeaderboardRecord(S2)(S1)(leaderboard);
    }
};

const getHeroNameFromId = id => (heroes[id] ? heroes[id].localized_name : 'Unknown');

const createMatchPlayerDetails = data => `**${data.personaname}**
*${getHeroNameFromId(data.hero_id)}* (${data.level})
KDA: ${data.kills}/${data.deaths}/${data.assists}
CS: ${data.last_hits}/${data.denies}
Gold: ${data.total_gold} (${data.gold_per_min}/min)`;

const getOpenDotaMatchDetails = async (match_id) => {
    logger.silly(`matchTracker getOpenDotaMatchDetails ${match_id}`);
    try {
        const response = await got(`https://api.opendota.com/api/matches/${match_id}`, { json: true });
        return response.body && !response.body.error ? response.body : null;
    }
    catch (e) {
        logger.error(e);
        return null;
    }
};

const getValveMatchDetails = async (match_id) => {
    logger.silly(`matchTracker getValveMatchDetails ${match_id}`);
    try {
        const response = await got(`http://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/?key=${process.env.STEAM_API_KEY}&match_id=${match_id}`, { json: true });
        return response.body && response.body.result && !response.body.result.error ? response.body : null;
    }
    catch (e) {
        logger.error(e);
        return null;
    }
};

const setMatchDetails = async (lobbyOrState) => {
    logger.silly(`matchTracker setMatchDetails match_id ${lobbyOrState.match_id}`);
    const lobby = await Lobby.getLobby(lobbyOrState);
    logger.silly(`matchTracker setMatchDetails lobby.id ${lobby.id} ${lobby.match_id}`);
    const data = {};
    if (!lobby.odata_data) {
        const odota_data = await getOpenDotaMatchDetails(lobby.match_id);
        if (odota_data) {
            await Db.updateLobby({
                odota_data,
                finished_at: odota_data.start_time + odota_data.duration * 1000,
                id: lobby.id,
            });
        }
    }
    return lobby.reload();
};

const setMatchPlayerDetails = async (_lobby) => {
    const lobby = await Lobby.getLobby(_lobby);
    const players = await Lobby.getPlayers()(lobby);
    let winner = 0;
    for (const player_data of lobby.odota_data.players) {
        if (player_data.account_id) {
            const steamid_64 = convertor.to64(player_data.account_id);
            const player = players.find(p => p.steamid_64 === steamid_64);
            if (player) {
                const data = {
                    win: player_data.win,
                    lose: player_data.lose,
                    hero_id: player_data.hero_id,
                    kills: player_data.kills,
                    deaths: player_data.deaths,
                    assists: player_data.assists,
                    gpm: player_data.gold_per_min,
                    xpm: player_data.xp_per_min,
                };
                await Lobby.updateLobbyPlayerBySteamId(data)(_lobby)(steamid_64);
                if (player.id === lobby.captain_1_user_id) {
                    if (player_data.win === 1) {
                        winner = 1;
                    }
                }
                else if (player.id === lobby.captain_2_user_id) {
                    if (player_data.win === 1) {
                        winner = 2;
                    }
                }
            }
        }
    }
    await Db.updateLobbyWinner(lobby)(winner);
};

const createMatchEndMessageEmbed = async (match_id) => {
    const lobby = await Db.findLobbyByMatchId(match_id);
    const { odota_data } = lobby;

    const players = await Lobby.getPlayers()({ id: lobby.id });
    const captain_1 = players.find(player => player.id === lobby.captain_1_user_id);
    const captain_2 = players.find(player => player.id === lobby.captain_2_user_id);
    const captain_1_data = odota_data.players.find(player => player.account_id.toString() === convertor.to32(captain_1.steamid_64));
    const captain_2_data = odota_data.players.find(player => player.account_id.toString() === convertor.to32(captain_2.steamid_64));
    const radiant_captain_player = captain_1_data.isRadiant ? captain_1_data : captain_2_data;
    const dire_captain_player = captain_1_data.isRadiant ? captain_2_data : captain_1_data;
    logger.silly(`createMatchEndMessageEmbed radiant_name ${radiant_captain_player.personaname}`);
    logger.silly(`createMatchEndMessageEmbed dire_name ${dire_captain_player.personaname}`);
    const radiant_name = radiant_captain_player.personaname;
    const dire_name = dire_captain_player.personaname;

    const radiant_details = odota_data.players.filter(player => player.isRadiant).map(createMatchPlayerDetails).join('\t\n\n');
    const dire_details = odota_data.players.filter(player => !player.isRadiant).map(createMatchPlayerDetails).join('\t\n\n');

    const title = `${radiant_name} vs ${dire_name}`;

    const winner = odota_data.radiant_win ? radiant_name : dire_name;

    const gold_lead = odota_data.radiant_gold_adv[odota_data.radiant_gold_adv.length - 1];
    const gold_lead_team = gold_lead > 0 ? 'Radiant' : 'Dire';

    const xp_lead = odota_data.radiant_xp_adv[odota_data.radiant_xp_adv.length - 1];
    const xp_lead_team = xp_lead > 0 ? 'Radiant' : 'Dire';

    const duration_hours = Math.floor(odota_data.duration / 3600);
    const duration_minutes = Math.floor((odota_data.duration % 3600) / 60);
    const duration_seconds = odota_data.duration % 3600 % 60;

    const duration = `${duration_hours > 0 ? `${duration_hours.toString()}:` : ''}${`${duration_minutes.toString().padStart(2, '0')}:`}${duration_seconds.toString().padStart(2, '0')}`;

    const description = `**${winner}** Victory!
Match ID: ${match_id} [DB](https://www.dotabuff.com/matches/${match_id})/[OD](https://www.opendota.com/matches/${match_id})/[SZ](https://stratz.com/en-us/match/${match_id})`;

    const match_details = `**Duration:** ${duration}
**Score:** ${odota_data.radiant_score} - ${odota_data.dire_score}
**Gold:** +${Math.abs(gold_lead)} ${gold_lead_team}
**Exp:** +${Math.abs(xp_lead)} ${xp_lead_team}
`;
    return {
        embed: {
            color: 3447003,
            title,
            description,
            fields: [
                {
                    name: 'Match Details',
                    value: match_details,
                },
                {
                    name: radiant_name,
                    value: radiant_details,
                    inline: true,
                },
                {
                    name: dire_name,
                    value: dire_details,
                    inline: true,
                },
            ],
        },
    };
};

/**
 * Match tracker checks opendota and valve match apis to see if a match has finished
 * and saves the match data to the database. */
class MatchTracker extends EventEmitter {
    /**
     * Creates an inhouse league match tracker.
     */
    constructor(interval) {
        super();
        this.interval = interval;
        this.enabled = true;
        this.blocking = false;
        this.lobbies = [];
        this.runTimer = null;
    }

    async loadLobbies() {
        let lobbies = await Db.findAllInProgressLobbies();
        this.lobbies.push(...lobbies.map(lobby => ({
            lobby,
            lastCheck: null,
        })));
        lobbies = await Db.findAllMatchEndedLobbies();
        this.lobbies.push(...lobbies.map(lobby => ({
            lobby,
            lastCheck: null,
        })));
    }

    addLobby(lobby) {
        this.lobbies.push({
            lobby,
            lastCheck: null,
        });
    }

    /**
     * The match polling loop
     * @async
     * @fires module:ihlManager~EVENT_MATCH_STATS
     */
    async run() {
        logger.silly(`matchTracker run ${this.blocking}`);
        if (this.blocking) return;
        if (this.enabled && this.lobbies.length) {
            this.blocking = true;
            const data = this.lobbies.shift();
            if (!data.lastCheck || data.lastCheck < Date.now() - this.interval) {
                data.lastCheck = Date.now();
                const lobby = await setMatchDetails(data.lobby);
                if (lobby.odota_data) {
                    await setMatchPlayerDetails(lobby);
                    this.emit(CONSTANTS.EVENT_MATCH_STATS, lobby);
                }
                else if (lobby.state === CONSTANTS.STATE_MATCH_IN_PROGRESS || 
                         lobby.state === CONSTANTS.STATE_MATCH_ENDED) {
                    logger.silly(`matchTracker no data, queueing ${lobby.id}`);
                    const maxCheckTime = new Date();
                    maxCheckTime.setHours(maxCheckTime.getHours() - 4);
                    if (lobby.started_at < maxCheckTime) {
                        this.lobbies.push(data);
                    }
                    else {
                        this.emit(CONSTANTS.EVENT_MATCH_NO_STATS, lobby);
                    }
                }

                if (this.lobbies.length) {
                    logger.silly(`matchTracker looping`);
                    this.runTimer = setTimeout(() => this.run(), 1000);
                }
            }
            else {
                data.lastCheck = Date.now();
                this.lobbies.push(data);
            }
            this.blocking = false;
        }
    }

    /**
     * Enables the match polling loop
     * @async
     */
    enable() {
        logger.silly('matchTracker start');
        this.enabled = true;
    }

    /**
     * Disables the match polling loop
     * @async
     */
    disable() {
        this.enabled = false;
        clearTimeout(this.runTimer);
    }
}

module.exports = {
    calcEloChange,
    updatePlayerRatings,
    getOpenDotaMatchDetails,
    getValveMatchDetails,
    setMatchDetails,
    setMatchPlayerDetails,
    createMatchEndMessageEmbed,
    MatchTracker,
};
