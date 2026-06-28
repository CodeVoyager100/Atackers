(function bootstrapGameData(global) {
    const GAME_DATA = {
        gameModes: {
            easyStage: { name: 'Easy Stage', maxPlayers: 4, teams: false, fillBots: true, easyStage: true },
            showdown: { name: 'Showdown', maxPlayers: 8, teams: false, fillBots: true },
            '3v3': { name: '3v3 Team Battle', maxPlayers: 12, teams: true, teamSize: 3, teamNames: ['red', 'blue', 'green', 'yellow'], fillBots: true },
            '2v2': { name: '2v2 Team Battle', maxPlayers: 8, teams: true, teamSize: 2, teamNames: ['red', 'blue', 'green', 'yellow'], fillBots: true },
            ballGoal: { name: 'Ball-Goal', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true },
            bounty: { name: 'Bounty', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true, bountyMode: true },
            elimination: { name: 'Elimination', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true, noRespawn: true },
            kingTown: { name: 'King of the Town', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true },
            zoneCapture: { name: 'Zone Capture', maxPlayers: 6, teams: true, teamSize: 3, teamNames: ['red', 'blue'], fillBots: true }
        },
        chestTiers: [
            { name: 'Common', color: '#b0b0b0', bg: 'linear-gradient(135deg, #2a2a2a, #3a3a3a)', glow: 'rgba(176,176,176,0.3)', upgradeChance: 0.35 },
            { name: 'Rare', color: '#4a8af5', bg: 'linear-gradient(135deg, #1a2a4a, #2a3a6a)', glow: 'rgba(74,138,245,0.4)', upgradeChance: 0.25 },
            { name: 'Epic', color: '#b44aff', bg: 'linear-gradient(135deg, #2a1a3a, #4a2a6a)', glow: 'rgba(180,74,255,0.4)', upgradeChance: 0.15 },
            { name: 'Mythic', color: '#ff4a6a', bg: 'linear-gradient(135deg, #3a1a1a, #6a2a2a)', glow: 'rgba(255,74,106,0.4)', upgradeChance: 0.08 },
            { name: 'Legendary', color: '#ffaa00', bg: 'linear-gradient(135deg, #3a2a0a, #5a4a1a, #6a5a20)', glow: 'rgba(255,170,0,0.5)', upgradeChance: 0 }
        ],
        dailyChallenges: [
            { id: 'win2', desc: 'Win 2 matches', type: 'wins', target: 2, reward: { type: 'sparks', amount: 250 }, icon: '🏆' },
            { id: 'win3', desc: 'Win 3 matches', type: 'wins', target: 3, reward: { type: 'sparks', amount: 400 }, icon: '🏆' },
            { id: 'kill8', desc: 'Get 8 kills in total', type: 'kills', target: 8, reward: { type: 'sparks', amount: 300 }, icon: '⚡' },
            { id: 'kill12', desc: 'Get 12 kills in total', type: 'kills', target: 12, reward: { type: 'sparks', amount: 450 }, icon: '⚡' },
            { id: 'kill5match', desc: 'Get 5 kills in one match', type: 'matchKills', target: 5, reward: { type: 'sparks', amount: 360 }, icon: '🎯' },
            { id: 'play3', desc: 'Play 3 matches', type: 'games', target: 3, reward: { type: 'sparks', amount: 220 }, icon: '🎮' },
            { id: 'play5', desc: 'Play 5 matches', type: 'games', target: 5, reward: { type: 'sparks', amount: 380 }, icon: '🎮' },
            { id: 'streak3', desc: 'Get a 3-kill streak', type: 'streak', target: 3, reward: { type: 'sparks', amount: 360 }, icon: '🔥' },
            { id: 'streak5', desc: 'Reach RAMPAGE (5 streak)', type: 'streak', target: 5, reward: { type: 'sparks', amount: 650 }, icon: '💥' },
            { id: 'damage1200', desc: 'Deal 1200 total damage', type: 'damage', target: 1200, reward: { type: 'sparks', amount: 320 }, icon: '💣' },
            { id: 'damage2000', desc: 'Deal 2000 total damage', type: 'damage', target: 2000, reward: { type: 'sparks', amount: 520 }, icon: '💥' },
            { id: 'survive120', desc: 'Survive 2 minutes in one match', type: 'survive', target: 120, reward: { type: 'sparks', amount: 320 }, icon: '⏱️' },
            { id: 'winstreak2', desc: 'Win 2 matches in a row', type: 'winstreak', target: 2, reward: { type: 'coins', amount: 150 }, icon: '🔴' },
            { id: 'winstreak3', desc: 'Win 3 matches in a row', type: 'winstreak', target: 3, reward: { type: 'sparks', amount: 400 }, icon: '🎯' },
            { id: 'coins200', desc: 'Earn 200 coins total', type: 'coins', target: 200, reward: { type: 'sparks', amount: 280 }, icon: '💰' },
            { id: 'coins500', desc: 'Earn 500 coins total', type: 'coins', target: 500, reward: { type: 'sparks', amount: 550 }, icon: '💰' }
        ],
        balanceSandboxDefaults: {
            botSuperMinMs: 800,
            botSuperMaxMs: 1600,
            botShootChanceMultiplier: 1,
            botCooldownMultiplier: 1
        }
    };

    global.GAME_DATA = Object.assign({}, global.GAME_DATA || {}, GAME_DATA);
})(window);
