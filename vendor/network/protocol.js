import { PlayerRole, } from "../engine/game.js";
export const NETWORK_PROTOCOL_VERSION = 4;
export const encodeMessage = (message) => `${JSON.stringify(message)}\n`;
export const createClientSnapshot = (snapshot, viewerId) => ({
    ...snapshot,
    players: snapshot.players.map((player) => ({
        ...player,
        hand: player.id === viewerId ? player.hand : null,
        handCount: player.hand.length,
        role: player.id === viewerId || player.role === PlayerRole.Lord || !player.alive ? player.role : "未知",
        treasureCards: player.id === viewerId ? player.treasureCards : null,
        treasureCardCount: player.treasureCards.length,
    })),
});
