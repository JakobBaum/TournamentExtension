import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  getDocs,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_e86-PXQcucrkEN1x5zCfJA7f3QhNqZs",
  authDomain: "autodarts-tournament.firebaseapp.com",
  projectId: "autodarts-tournament",
  storageBucket: "autodarts-tournament.firebasestorage.app",
  messagingSenderId: "955847975035",
  appId: "1:955847975035:web:43dcf244d2dd15207682de",
};

// 🔥 Singleton Init
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 Default Player Stats zentral
const DEFAULT_PLAYER_STATS = {
  points: 0,
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  legsWon: 0,
  legsLost: 0,
  setsWon: 0,
  setsLost: 0,

  totalAverageSum: 0,
  averageCount: 0,
  average: 0,

  totalCheckoutsHit: 0,
  totalCheckouts: 0,
  checkoutPercent: 0,

  plus60: 0,
  plus100: 0,
  plus140: 0,
  plus171Or180: 0,

  bestCheckout: 0,
};

export class TournamentDB {
  constructor() {
    this.db = db;
  }

  // =========================
  // 🔧 HELPERS
  // =========================
  tRef(tournamentId, path) {
    return collection(this.db, "tournaments", tournamentId, path);
  }

  tDoc(tournamentId, path, id) {
    return doc(this.db, "tournaments", tournamentId, path, id);
  }

  mapSnap(snapshot) {
    return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
  }

  normalizePlayerStats(stats = {}) {
    return {
      average: Number(stats?.average || 0),

      checkoutsHit: Number(
        stats?.checkoutsHit ??
        0
      ),

      checkoutsAttempted: Number(
        stats?.checkouts ??
        0
      ),

      plus60: Number(stats?.plus60 || 0),
      plus100: Number(stats?.plus100 || 0),
      plus140: Number(stats?.plus140 || 0),
      plus170: Number(stats?.plus170 || 0),
      total180: Number(stats?.total180 || 0),
      checkoutPoints: Number(stats?.checkoutPoints || 0),
    };
  }

  hasPlayerThrownDarts(stats = {}) {
    const possibleDartCounts = [
      stats?.dartsThrown,
      stats?.thrownDarts,
      stats?.totalDarts,
      stats?.darts,
      stats?.throws,
    ];

    return possibleDartCounts.some((value) => Number(value || 0) > 0);
  }

  extractScoreSummary(score) {
    if (score == null) {
      return { legs: 0, sets: 0 };
    }

    if (typeof score === "object") {
      return {
        legs: Number(score?.legs || 0),
        sets: Number(score?.sets || 0),
      };
    }

    const numericScore = Number(score);
    return {
      legs: Number.isFinite(numericScore) ? numericScore : 0,
      sets: 0,
    };
  }

  isRealPlayer(player) {
    return !!player && typeof player === "object" && player.type === "player";
  }

  isBye(player) {
    return !!player && typeof player === "object" && player.type === "bye";
  }

  isMatchPlaceholder(player) {
    return !!player && typeof player === "object" && player.type === "match";
  }

  isQualifierPlaceholder(player) {
    return !!player && typeof player === "object" && player.type === "qualifier";
  }

  createBye() {
    return {
      type: "bye",
      name: "Freilos",
    };
  }

  createMatchRef(ref, source = "winner") {
    return {
      type: "match",
      ref: Number(ref),
      source,
    };
  }

  createQualifierPlaceholder(ref) {
    return {
      type: "qualifier",
      ref,
      qualifierRef: ref,
    };
  }

  buildPlayerSignature(player) {
    if (!player) return "null";

    if (player.type === "player") {
      return JSON.stringify({
        type: "player",
        id: player.id || null,
        name: player.name || null,
        groupId: player.groupId || null,
        qualifierRef: player.qualifierRef || null,
      });
    }

    if (player.type === "match") {
      return JSON.stringify({
        type: "match",
        ref: Number(player.ref),
        source: player.source || "winner",
      });
    }

    if (player.type === "qualifier") {
      return JSON.stringify({
        type: "qualifier",
        ref: player.ref || null,
        qualifierRef: player.qualifierRef || player.ref || null,
      });
    }

    if (player.type === "bye") {
      return JSON.stringify({
        type: "bye",
        name: "Freilos",
      });
    }

    return JSON.stringify(player);
  }

  normalizePropagatedPlayer(player, fallbackQualifierRef = null) {
    if (!player) return null;

    if (player.type === "player") {
      return {
        type: "player",
        id: player.id || null,
        name: player.name || "—",
        groupId: player.groupId || null,
        ...(fallbackQualifierRef ? { qualifierRef: fallbackQualifierRef } : {}),
      };
    }

    if (player.type === "bye") {
      return this.createBye();
    }

    if (player.type === "qualifier") {
      const ref = player.qualifierRef || player.ref;
      return this.createQualifierPlaceholder(ref);
    }

    if (player.type === "match") {
      return {
        type: "match",
        ref: Number(player.ref),
        source: player.source || "winner",
      };
    }

    return player;
  }

  clearMatchResultFields() {
    return {
      winner: null,
      loser: null,
      status: "pending",
      startedAt: null,
      finishedAt: null,
      scorePlayer1: null,
      scorePlayer2: null,
      finalPlayerStats: null,
      statsUpdatedAt: null,
      resultSource: null,
      manuallyCorrectedAt: null,
      lobbyId: null,
      boardId: null,
    };
  }

  buildGroupLetter(groupName = "") {
    const match = String(groupName || "").match(/Gruppe\s+([A-Z])/i);
    return match ? match[1].toUpperCase() : null;
  }

  buildPlayerStatsFromMatches(matches = [], players = []) {
    const playerStatsMap = new Map();

    for (const player of players) {
      const key = String(player.name || "")
        .trim()
        .toLowerCase();
      if (!key) continue;

      playerStatsMap.set(key, {
        playerId: player.id,
        playerName: player.name,
        ...DEFAULT_PLAYER_STATS,
      });
    }

    for (const match of matches) {
      if (match?.status !== "finished") continue;
      if (match?.player1?.type !== "player" || match?.player2?.type !== "player") continue;

      const player1Key = String(match.player1.name || "")
        .trim()
        .toLowerCase();
      const player2Key = String(match.player2.name || "")
        .trim()
        .toLowerCase();
      const player1Stats = playerStatsMap.get(player1Key);
      const player2Stats = playerStatsMap.get(player2Key);

      if (!player1Stats || !player2Stats) continue;

      player1Stats.matchesPlayed += 1;
      player2Stats.matchesPlayed += 1;

      const winnerName = String(match?.winner?.name || "")
        .trim()
        .toLowerCase();
      if (winnerName && winnerName === player1Key) {
        player1Stats.wins += 1;
        player2Stats.losses += 1;
      } else if (winnerName && winnerName === player2Key) {
        player2Stats.wins += 1;
        player1Stats.losses += 1;
      }

      const score1 = this.extractScoreSummary(match.scorePlayer1);
      const score2 = this.extractScoreSummary(match.scorePlayer2);

      player1Stats.legsWon += score1.legs;
      player1Stats.legsLost += score2.legs;
      player2Stats.legsWon += score2.legs;
      player2Stats.legsLost += score1.legs;

      player1Stats.setsWon += score1.sets;
      player1Stats.setsLost += score2.sets;
      player2Stats.setsWon += score2.sets;
      player2Stats.setsLost += score1.sets;

      const finalEntries = Array.isArray(match.finalPlayerStats) ? match.finalPlayerStats : [];

      for (const entry of finalEntries) {
        const playerKey = String(entry?.name || "")
          .trim()
          .toLowerCase();
        const target = playerStatsMap.get(playerKey);
        if (!target || !entry?.stats) continue;

        const normalizedStats = this.normalizePlayerStats(entry.stats);
        const hasThrownDarts = this.hasPlayerThrownDarts(entry.stats);

        if (hasThrownDarts) {
          target.totalAverageSum += normalizedStats.average || 0;
          target.averageCount += 1;
        }

        target.plus60 += normalizedStats.plus60 || 0;
        target.plus100 += normalizedStats.plus100 || 0;
        target.plus140 += normalizedStats.plus140 || 0;
        target.plus171Or180 += (normalizedStats.plus170 || 0) + (normalizedStats.total180 || 0);

        target.totalCheckoutsHit += normalizedStats.checkoutsHit || 0;
        target.totalCheckouts += normalizedStats.checkoutsAttempted || 0;

        target.bestCheckout = Math.max(
          target.bestCheckout || 0,
          normalizedStats.checkoutPoints || 0,
        );
      }
    }

    for (const stats of playerStatsMap.values()) {
      stats.average =
        stats.averageCount > 0 ? stats.totalAverageSum / stats.averageCount : 0;

      stats.checkoutPercent =
        stats.totalCheckouts > 0
          ? (stats.totalCheckoutsHit / stats.totalCheckouts) * 100
          : 0;
    }

    return playerStatsMap;
  }

  async recalculatePlayerStatsFromMatches(tournamentId) {
    if (!tournamentId) return;

    const players = await this.getPlayersByTournamentId(tournamentId);
    const matches = await this.getMatchesByTournamentId(tournamentId);
    const playerStatsMap = this.buildPlayerStatsFromMatches(matches, players);

    await Promise.all(
      players.map((player) => {
        const key = String(player.name || "")
          .trim()
          .toLowerCase();
        const nextStats = playerStatsMap.get(key) || {
          playerId: player.id,
          playerName: player.name,
          ...DEFAULT_PLAYER_STATS,
        };

        return updateDoc(this.tDoc(tournamentId, "players", player.id), {
          ...DEFAULT_PLAYER_STATS,
          matchesPlayed: nextStats.matchesPlayed || 0,
          wins: nextStats.wins || 0,
          losses: nextStats.losses || 0,
          legsWon: nextStats.legsWon || 0,
          legsLost: nextStats.legsLost || 0,
          setsWon: nextStats.setsWon || 0,
          setsLost: nextStats.setsLost || 0,
          totalAverageSum: nextStats.totalAverageSum || 0,
          averageCount: nextStats.averageCount || 0,
          average: nextStats.average || 0,
          totalCheckoutsHit: nextStats.totalCheckoutsHit || 0,
          totalCheckouts: nextStats.totalCheckouts || 0,
          checkoutPercent: nextStats.checkoutPercent || 0,
          plus60: nextStats.plus60 || 0,
          plus100: nextStats.plus100 || 0,
          plus140: nextStats.plus140 || 0,
          plus171Or180: nextStats.plus171Or180 || 0,
          bestCheckout: nextStats.bestCheckout || 0,
          liveAverage: 0,
          lastStatsUpdateAt: new Date(),
        });
      }),
    );
  }

  buildGroupStandings(matches = [], groupName, qualifiedPerGroup = 2) {
    const groupMatches = matches.filter((match) => match?.group === groupName);
    const table = new Map();

    const ensurePlayer = (player) => {
      if (!player || player.type !== "player") return null;

      const key = String(player.id || player.name || "")
        .trim()
        .toLowerCase();
      if (!key) return null;

      if (!table.has(key)) {
        table.set(key, {
          key,
          player: {
            type: "player",
            id: player.id || null,
            name: player.name || "—",
            groupId: player.groupId || null,
          },
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
          legsWon: 0,
          legsLost: 0,
          legDiff: 0,
          setsWon: 0,
          setsLost: 0,
          setDiff: 0,
        });
      }

      return table.get(key);
    };

    for (const match of groupMatches) {
      ensurePlayer(match?.player1);
      ensurePlayer(match?.player2);

      if (match?.status !== "finished") continue;
      if (match?.player1?.type !== "player" || match?.player2?.type !== "player") continue;

      const entry1 = ensurePlayer(match.player1);
      const entry2 = ensurePlayer(match.player2);
      if (!entry1 || !entry2) continue;

      entry1.played += 1;
      entry2.played += 1;

      const score1 = this.extractScoreSummary(match.scorePlayer1);
      const score2 = this.extractScoreSummary(match.scorePlayer2);

      entry1.legsWon += score1.legs;
      entry1.legsLost += score2.legs;
      entry2.legsWon += score2.legs;
      entry2.legsLost += score1.legs;

      entry1.setsWon += score1.sets;
      entry1.setsLost += score2.sets;
      entry2.setsWon += score2.sets;
      entry2.setsLost += score1.sets;

      const winnerKey = String(match?.winner?.id || match?.winner?.name || "")
        .trim()
        .toLowerCase();

      if (winnerKey && winnerKey === entry1.key) {
        entry1.wins += 1;
        entry1.points += 2;
        entry2.losses += 1;
      } else if (winnerKey && winnerKey === entry2.key) {
        entry2.wins += 1;
        entry2.points += 2;
        entry1.losses += 1;
      }
    }

    const standings = [...table.values()].map((entry) => ({
      ...entry,
      legDiff: entry.legsWon - entry.legsLost,
      setDiff: entry.setsWon - entry.setsLost,
    }));

    standings.sort((a, b) => {
      const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
      if (pointsDiff !== 0) return pointsDiff;

      const winsDiff = Number(b.wins || 0) - Number(a.wins || 0);
      if (winsDiff !== 0) return winsDiff;

      const legDiff = Number(b.legDiff || 0) - Number(a.legDiff || 0);
      if (legDiff !== 0) return legDiff;

      const legsWonDiff = Number(b.legsWon || 0) - Number(a.legsWon || 0);
      if (legsWonDiff !== 0) return legsWonDiff;

      const setDiff = Number(b.setDiff || 0) - Number(a.setDiff || 0);
      if (setDiff !== 0) return setDiff;

      return String(a.player?.name || "").localeCompare(String(b.player?.name || ""), "de", {
        sensitivity: "base",
      });
    });

    return standings.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isQualified: index < qualifiedPerGroup,
    }));
  }

  async getTournamentById(tournamentId) {
    const snap = await getDoc(doc(this.db, "tournaments", tournamentId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async getMatchesByTournamentId(tournamentId) {
    const snap = await getDocs(this.tRef(tournamentId, "matches"));
    return this.mapSnap(snap);
  }

  async findNextMatchForReference(tournamentId, refNumber, providedMatches = null) {
    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    return matches.find(
      (m) =>
        String(m.player1?.ref) === String(refNumber) ||
        String(m.player2?.ref) === String(refNumber),
    );
  }

  getDependentMatchesBySource(matches = [], sourceMatchNumber) {
    return matches.filter(
      (m) =>
        String(m.player1?.ref) === String(sourceMatchNumber) ||
        String(m.player2?.ref) === String(sourceMatchNumber),
    );
  }

  async getMatchById(tournamentId, matchId, providedMatches = null) {
    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    return matches.find((m) => m.id === matchId) || null;
  }

  async getDependentMatches(tournamentId, sourceMatchNumber, providedMatches = null) {
    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    return this.getDependentMatchesBySource(matches, sourceMatchNumber);
  }

  async resetMatchChainFromMatchNumber(
    tournamentId,
    sourceMatchNumber,
    providedMatches = null,
    visited = new Set(),
  ) {
    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    const dependents = await this.getDependentMatches(tournamentId, sourceMatchNumber, matches);

    for (const dependent of dependents) {
      if (!dependent?.id || visited.has(dependent.id)) continue;
      visited.add(dependent.id);

      const updates = { ...this.clearMatchResultFields() };

      if (
        dependent.player1?.type === "player" &&
        String(dependent.player1?.qualifierRef || "") === ""
      ) {
        if (String(dependent.player1?.name || "") === String(dependent.winner?.name || "")) {
          // absichtlich nichts extra
        }
      }

      if (
        dependent.player1?.type === "player" &&
        String(dependent.player1?.qualifierRef || "") === "" &&
        String(dependent.player1?.id || "") !== "" &&
        String(dependent.player1?.id || "") === String(dependent.player1?.id || "")
      ) {
        // noop, nur um keine zu aggressive Rücksetzung auf Nicht-Referenz-Slots zu machen
      }

      if (
        dependent.player1?.type === "player" &&
        String(dependent.player1?.qualifierRef || "") &&
        false
      ) {
        // noop
      }

      if (
        dependent.player1?.type === "player" &&
        String(dependent.player1?.qualifierRef || "") === "" &&
        String(dependent.player1?.name || "") !== ""
      ) {
        // noop
      }

      if (
        dependent.player1?.type === "match" &&
        String(dependent.player1.ref) === String(sourceMatchNumber)
      ) {
        updates.player1 = this.createMatchRef(sourceMatchNumber, dependent.player1?.source || "winner");
      }

      if (
        dependent.player2?.type === "match" &&
        String(dependent.player2.ref) === String(sourceMatchNumber)
      ) {
        updates.player2 = this.createMatchRef(sourceMatchNumber, dependent.player2?.source || "winner");
      }

      await updateDoc(this.tDoc(tournamentId, "matches", dependent.id), updates);

      await this.resetMatchChainFromMatchNumber(
        tournamentId,
        dependent.matchNumber,
        matches,
        visited,
      );
    }
  }

  async resetMatchAndDescendants(tournamentId, matchId) {
    if (!tournamentId || !matchId) return;

    const matches = await this.getMatchesByTournamentId(tournamentId);
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    await updateDoc(this.tDoc(tournamentId, "matches", matchId), {
      ...this.clearMatchResultFields(),
    });

    await this.resetMatchChainFromMatchNumber(tournamentId, match.matchNumber, matches, new Set());
  }

  async propagateFromMatch(tournamentId, sourceMatch, providedMatches = null) {
    if (!sourceMatch?.winner && !sourceMatch?.loser) return;

    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    const dependentMatches = this.getDependentMatchesBySource(matches, sourceMatch.matchNumber);

    for (const nextMatch of dependentMatches) {
      const updates = {};

      const resolveSourcePlayer = (slot) => {
        if (slot?.type !== "match") return null;
        if (String(slot.ref) !== String(sourceMatch.matchNumber)) return null;

        const sourceType = slot.source || "winner";
        const sourcePlayer = sourceType === "loser" ? sourceMatch.loser : sourceMatch.winner;
        return this.normalizePropagatedPlayer(sourcePlayer);
      };

      const propagatedPlayer1 = resolveSourcePlayer(nextMatch.player1);
      const propagatedPlayer2 = resolveSourcePlayer(nextMatch.player2);

      if (propagatedPlayer1) {
        updates.player1 = propagatedPlayer1;
      }

      if (propagatedPlayer2) {
        updates.player2 = propagatedPlayer2;
      }

      const newPlayer1 = updates.player1 ?? nextMatch.player1;
      const newPlayer2 = updates.player2 ?? nextMatch.player2;

      const p1Real = this.isRealPlayer(newPlayer1);
      const p2Real = this.isRealPlayer(newPlayer2);
      const p1Bye = this.isBye(newPlayer1);
      const p2Bye = this.isBye(newPlayer2);

      if (p1Real && p2Bye) {
        updates.winner = newPlayer1;
        updates.loser = newPlayer2;
        updates.status = "finished";
        updates.finishedAt = new Date().toISOString();
        updates.resultSource = "bye";
      } else if (p2Real && p1Bye) {
        updates.winner = newPlayer2;
        updates.loser = newPlayer1;
        updates.status = "finished";
        updates.finishedAt = new Date().toISOString();
        updates.resultSource = "bye";
      } else if (p1Bye && p2Bye) {
        updates.winner = this.createBye();
        updates.loser = this.createBye();
        updates.status = "finished";
        updates.finishedAt = new Date().toISOString();
        updates.resultSource = "bye";
      } else if (p1Real && p2Real) {
        updates.winner = null;
        updates.loser = null;
        updates.status = "pending";
        updates.finishedAt = null;
        updates.resultSource = null;
        updates.scorePlayer1 = null;
        updates.scorePlayer2 = null;
        updates.finalPlayerStats = null;
        updates.statsUpdatedAt = null;
        updates.manuallyCorrectedAt = null;
        updates.lobbyId = null;
        updates.boardId = null;
      }

      if (!Object.keys(updates).length) continue;

      await updateDoc(this.tDoc(tournamentId, "matches", nextMatch.id), updates);

      const updatedNextMatch = {
        ...nextMatch,
        ...updates,
      };

      if (updatedNextMatch.winner || updatedNextMatch.loser) {
        await this.propagateFromMatch(tournamentId, updatedNextMatch, matches);
      } else {
        await this.resetMatchChainFromMatchNumber(
          tournamentId,
          updatedNextMatch.matchNumber,
          matches,
          new Set(),
        );
      }
    }
  }

  async advanceWinnerToNextMatch(tournamentId, sourceMatch) {
    await this.propagateFromMatch(tournamentId, sourceMatch);
  }

  async syncGroupPhaseProgress(tournamentId, providedMatches = null) {
    if (!tournamentId) return;

    const tournament = await this.getTournamentById(tournamentId);
    if (!tournament || tournament.type !== "GROUP_KO") return;

    const qualifiedPerGroup = Math.max(1, Number(tournament?.settings?.qualifiers || 2));
    const matches = Array.isArray(providedMatches)
      ? providedMatches
      : await this.getMatchesByTournamentId(tournamentId);

    const groupMatches = matches.filter((match) => !!match.group);
    if (!groupMatches.length) return;

    const groupNames = [...new Set(groupMatches.map((match) => match.group).filter(Boolean))];
    const qualifierMap = new Map();

    for (const groupName of groupNames) {
      const groupLetter = this.buildGroupLetter(groupName);
      if (!groupLetter) continue;

      const matchesOfGroup = groupMatches.filter((match) => match.group === groupName);
      const isComplete =
        matchesOfGroup.length > 0 && matchesOfGroup.every((match) => match.status === "finished");

      let standings = [];
      if (isComplete) {
        standings = this.buildGroupStandings(matches, groupName, qualifiedPerGroup);
      }

      for (let rank = 1; rank <= qualifiedPerGroup; rank += 1) {
        const ref = `G${groupLetter}-${rank}`;

        if (!isComplete) {
          qualifierMap.set(ref, this.createQualifierPlaceholder(ref));
          continue;
        }

        const rankedPlayer = standings[rank - 1]?.player || null;

        qualifierMap.set(
          ref,
          rankedPlayer
            ? {
                ...rankedPlayer,
                type: "player",
                qualifierRef: ref,
              }
            : this.createQualifierPlaceholder(ref),
        );
      }
    }

    const koMatches = matches.filter((match) => !match.group);

    for (const match of koMatches) {
      const updates = {};

      for (const slot of ["player1", "player2"]) {
        const current = match?.[slot];
        const qualifierRef =
          current?.qualifierRef || (current?.type === "qualifier" ? current?.ref : null);

        if (!qualifierRef || !qualifierMap.has(qualifierRef)) continue;

        const replacement = qualifierMap.get(qualifierRef);

        if (this.buildPlayerSignature(replacement) !== this.buildPlayerSignature(current)) {
          updates[slot] = replacement;
        }
      }

      if (Object.keys(updates).length) {
        updates.winner = null;
        updates.loser = null;
        updates.finishedAt = null;
        updates.scorePlayer1 = null;
        updates.scorePlayer2 = null;
        updates.finalPlayerStats = null;
        updates.statsUpdatedAt = null;
        updates.resultSource = null;
        updates.manuallyCorrectedAt = null;

        const newPlayer1 = updates.player1 ?? match.player1;
        const newPlayer2 = updates.player2 ?? match.player2;

        const p1Ready = this.isRealPlayer(newPlayer1);
        const p2Ready = this.isRealPlayer(newPlayer2);
        const p1Bye = this.isBye(newPlayer1);
        const p2Bye = this.isBye(newPlayer2);

        if (p1Ready && p2Bye) {
          updates.winner = newPlayer1;
          updates.loser = newPlayer2;
          updates.status = "finished";
          updates.finishedAt = new Date().toISOString();
          updates.resultSource = "bye";
        } else if (p2Ready && p1Bye) {
          updates.winner = newPlayer2;
          updates.loser = newPlayer1;
          updates.status = "finished";
          updates.finishedAt = new Date().toISOString();
          updates.resultSource = "bye";
        } else if (p1Bye && p2Bye) {
          updates.winner = this.createBye();
          updates.loser = this.createBye();
          updates.status = "finished";
          updates.finishedAt = new Date().toISOString();
          updates.resultSource = "bye";
        } else {
          updates.status = "pending";
        }

        await updateDoc(this.tDoc(tournamentId, "matches", match.id), updates);

        const updatedMatch = {
          ...match,
          ...updates,
        };

        if (updatedMatch.winner) {
          await this.propagateFromMatch(tournamentId, updatedMatch, matches);
        } else {
          await this.resetMatchChainFromMatchNumber(
            tournamentId,
            updatedMatch.matchNumber,
            matches,
            new Set(),
          );
        }
      }
    }
  }

  // =========================
  // 🏆 TOURNAMENT
  // =========================
  async createTournament(name, code, type, settings = null) {
    const ref = await addDoc(collection(this.db, "tournaments"), {
      name,
      code,
      type,
      status: "waiting",
      settings: settings || null,
      createdAt: new Date(),
    });

    return ref.id;
  }

  async updateTournamentSettings(tournamentId, settings = {}) {
    if (!tournamentId) return;

    await updateDoc(doc(this.db, "tournaments", tournamentId), {
      settings: settings || null,
      settingsUpdatedAt: new Date(),
    });
  }

  async updateTournamentSetup(tournamentId, data = {}) {
    if (!tournamentId) return;

    const payload = {
      settings: data.settings || null,
      settingsUpdatedAt: new Date(),
    };

    if (typeof data.name === "string" && data.name.trim()) {
      payload.name = data.name.trim();
    }

    if (typeof data.type === "string" && data.type.trim()) {
      payload.type = data.type.trim();
    }

    await updateDoc(doc(this.db, "tournaments", tournamentId), payload);
  }

  async getTournamentByCode(code) {
    const snap = await getDocs(
      query(collection(this.db, "tournaments"), where("code", "==", code)),
    );

    if (snap.empty) return null;
    const first = snap.docs[0];

    return { id: first.id, ...first.data() };
  }

  // =========================
  // 👥 GROUPS
  // =========================
  async createGroups(tournamentId, groups) {
    return Promise.all(
      groups.map(async (group) => {
        const ref = await addDoc(this.tRef(tournamentId, "groups"), {
          name: group.name,
        });

        return { id: ref.id, ...group };
      }),
    );
  }

  async getGroupsByTournamentId(tournamentId) {
    const snap = await getDocs(this.tRef(tournamentId, "groups"));
    return this.mapSnap(snap);
  }

  // =========================
  // 🧑 PLAYERS
  // =========================
  async createPlayers(tournamentId, players) {
    return Promise.all(
      players.map(async (player) => {
        const name = typeof player === "object" ? player.name : player;

        const ref = await addDoc(this.tRef(tournamentId, "players"), {
          name,
          ...DEFAULT_PLAYER_STATS,
        });

        return { id: ref.id, name };
      }),
    );
  }

  async createPlayersGroups(tournamentId, groups) {
    const allPlayers = groups.flatMap((group) =>
      group.players.map((player) => ({
        name: player,
        groupId: group.id,
      })),
    );

    return Promise.all(
      allPlayers.map(async (p) => {
        const ref = await addDoc(this.tRef(tournamentId, "players"), {
          name: p.name,
          groupId: p.groupId,
          ...DEFAULT_PLAYER_STATS,
        });

        return { id: ref.id, ...p };
      }),
    );
  }

  async getPlayersByTournamentId(tournamentId) {
    const snap = await getDocs(
      query(this.tRef(tournamentId, "players"), orderBy("points", "desc")),
    );
    return this.mapSnap(snap);
  }

  async updatePlayerPoints(tournamentId, playerId, points) {
    await updateDoc(this.tDoc(tournamentId, "players", playerId), { points });
  }

  async autoAdvanceExistingWinners(tournamentId) {
    const matches = await this.getMatchesByTournamentId(tournamentId);

    const finishedMatches = matches
      .filter((match) => match.status === "finished" && match.winner)
      .sort((a, b) => Number(a.round) - Number(b.round));

    for (const match of finishedMatches) {
      await this.propagateFromMatch(tournamentId, match, matches);
    }
  }

  // =========================
  // 🎯 MATCHES
  // =========================
  async createMatches(tournamentId, matches, players) {
    const playerMap = new Map(players.map((p) => [p.name.trim(), p]));

    const buildPlayer = (input) => {
      if (!input) return null;

      if (input === "__BYE__" || input?.type === "bye") {
        return this.createBye();
      }

      if (typeof input === "string" && !isNaN(input)) {
        return this.createMatchRef(input, "winner");
      }

      if (typeof input === "object" && input?.type === "match") {
        return this.createMatchRef(input.ref, input.source || "winner");
      }

      if (typeof input === "object" && input?.type === "qualifier") {
        return this.createQualifierPlaceholder(input.qualifierRef || input.ref);
      }

      if (typeof input === "string" && /^G[A-Z]-\d+$/.test(input)) {
        return this.createQualifierPlaceholder(input);
      }

      const name = typeof input === "object" ? input.name : String(input).trim();
      const normalizedName = typeof name === "string" ? name.trim() : "";

      if (!normalizedName) {
        return null;
      }

      const found = playerMap.get(normalizedName);

      return {
        type: "player",
        id: found?.id || null,
        name: normalizedName,
        groupId: found?.groupId || null,
        ...(input?.qualifierRef ? { qualifierRef: input.qualifierRef } : {}),
      };
    };

    await Promise.all(
      matches.map((match) =>
        addDoc(this.tRef(tournamentId, "matches"), {
          matchNumber: match.matchNumber,
          player1: buildPlayer(match.player1),
          player2: buildPlayer(match.player2),
          winner: buildPlayer(match.winner),
          round: match.round,
          group: match.group || null,
          status: match.status || "pending",
          boardId: null,
          lobbyId: null,
          loser: buildPlayer(match.loser),
          bracketType: match.bracketType || "main",
          placementRangeStart: match.placementRangeStart ?? null,
          placementRangeEnd: match.placementRangeEnd ?? null,
          winnerPlace: match.winnerPlace ?? null,
          loserPlace: match.loserPlace ?? null,
          displayRoundName: match.displayRoundName || null,
          placementGroupLabel: match.placementGroupLabel || null,
          startedAt: null,
          finishedAt: null,
          scorePlayer1: null,
          scorePlayer2: null,
          finalPlayerStats: null,
          statsUpdatedAt: null,
          resultSource: null,
          manuallyCorrectedAt: null,
        }),
      ),
    );
  }

  async setMatchStarted(tournamentId, matchId, data = {}) {
    const ref = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(ref, {
      status: "started",
      startedAt: new Date(),
      ...data,
    });
  }

  async saveMatchScore(tournamentId, matchId, payload = {}) {
    if (!tournamentId || !matchId) return;

    const ref = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(ref, {
      scorePlayer1: payload.scorePlayer1 ?? null,
      scorePlayer2: payload.scorePlayer2 ?? null,
      statsUpdatedAt: new Date(),
      ...(payload.lobbyId ? { lobbyId: payload.lobbyId } : {}),
      ...(payload.boardId ? { boardId: payload.boardId } : {}),
    });
  }

  async setMatchFinished(tournamentId, matchId, winner, loser = null, extra = {}) {
    if (!tournamentId || !matchId || !winner) return;

    await this.resetMatchAndDescendants(tournamentId, matchId);

    const ref = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(ref, {
      winner,
      loser,
      status: "finished",
      finishedAt: extra?.finishedAt || new Date().toISOString(),
      resultSource: extra?.resultSource || "autodarts",
      finalPlayerStats: Array.isArray(extra?.finalPlayerStats) ? extra.finalPlayerStats : null,
      scorePlayer1: extra?.scorePlayer1 ?? null,
      scorePlayer2: extra?.scorePlayer2 ?? null,
      ...(extra?.lobbyId ? { lobbyId: extra.lobbyId } : {}),
      ...(extra?.boardId ? { boardId: extra.boardId } : {}),
      ...(extra?.statsUpdatedAt ? { statsUpdatedAt: extra.statsUpdatedAt } : {}),
    });

    const matches = await this.getMatchesByTournamentId(tournamentId);
    const fullMatch = matches.find((m) => m.id === matchId);

    if (fullMatch) {
      await this.propagateFromMatch(
        tournamentId,
        {
          ...fullMatch,
          winner,
          loser,
          status: "finished",
          finishedAt: extra?.finishedAt || new Date().toISOString(),
        },
        matches,
      );
    }

    await this.syncGroupPhaseProgress(tournamentId);
    await this.recalculatePlayerStatsFromMatches(tournamentId);
  }

  async setMatchAborted(tournamentId, matchId, extra = {}) {
    if (!tournamentId || !matchId) return;

    await this.resetMatchAndDescendants(tournamentId, matchId);

    const ref = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(ref, {
      ...this.clearMatchResultFields(),
      status: "aborted",
      resultSource: "aborted",
      statsUpdatedAt: new Date(),
      ...extra,
    });

    await this.syncGroupPhaseProgress(tournamentId);
    await this.recalculatePlayerStatsFromMatches(tournamentId);
  }

  async correctMatchResult(
    tournamentId,
    matchId,
    {
      winner,
      loser = null,
      scorePlayer1 = null,
      scorePlayer2 = null,
      finishedAt = new Date().toISOString(),
    } = {},
  ) {
    if (!tournamentId || !matchId || !winner) return;

    await this.resetMatchAndDescendants(tournamentId, matchId);

    const ref = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(ref, {
      winner,
      loser,
      status: "finished",
      finishedAt,
      scorePlayer1,
      scorePlayer2,
      resultSource: "manual",
      manuallyCorrectedAt: new Date(),
    });

    const matches = await this.getMatchesByTournamentId(tournamentId);
    const fullMatch = matches.find((m) => m.id === matchId);

    if (fullMatch) {
      await this.propagateFromMatch(
        tournamentId,
        {
          ...fullMatch,
          winner,
          loser,
          status: "finished",
          scorePlayer1,
          scorePlayer2,
          finishedAt,
        },
        matches,
      );
    }

    await this.syncGroupPhaseProgress(tournamentId);
    await this.recalculatePlayerStatsFromMatches(tournamentId);
  }

  async resetMatchToPending(tournamentId, matchId) {
    if (!tournamentId || !matchId) return;

    await this.resetMatchAndDescendants(tournamentId, matchId);

    const matchRef = this.tDoc(tournamentId, "matches", matchId);

    await updateDoc(matchRef, {
      ...this.clearMatchResultFields(),
      status: "pending",
    });

    await this.syncGroupPhaseProgress(tournamentId);
    await this.recalculatePlayerStatsFromMatches(tournamentId);
  }

  // =========================
  // 🎯 BOARDS
  // =========================
  async addBoards(tournamentId, boards) {
    await Promise.all(
      boards.map((b) =>
        addDoc(this.tRef(tournamentId, "boards"), {
          name: b.name,
          boardId: b.id,
          status: "free",
          currentMatchId: null,
        }),
      ),
    );
  }

  async assignBoard(tournamentId, board, matchId) {
    await Promise.all([
      updateDoc(this.tDoc(tournamentId, "boards", board.id), {
        status: "busy",
        currentMatchId: matchId,
      }),
      updateDoc(this.tDoc(tournamentId, "matches", matchId), {
        boardId: board.boardId,
      }),
    ]);
  }

  async releaseBoard(tournamentId, boardId) {
    const boardRef = doc(this.db, "tournaments", tournamentId, "boards", boardId);

    await updateDoc(boardRef, {
      status: "free",
      currentMatchId: null,
    });
  }

  // =========================
  // 🔴 REALTIME
  // =========================
  subscribeToMatches(tournamentId, cb) {
    return onSnapshot(this.tRef(tournamentId, "matches"), (snap) => cb(this.mapSnap(snap)));
  }

  subscribeToBoards(tournamentId, cb) {
    return onSnapshot(this.tRef(tournamentId, "boards"), (snap) => cb(this.mapSnap(snap)));
  }

  subscribeToFreeBoards(tournamentId, cb) {
    const q = query(this.tRef(tournamentId, "boards"), where("status", "==", "free"));
    return onSnapshot(q, (snap) => cb(this.mapSnap(snap)));
  }

  subscribeToPlayers(tournamentId, cb) {
    const q = query(this.tRef(tournamentId, "players"), orderBy("points", "desc"));
    return onSnapshot(q, (snap) => cb(this.mapSnap(snap)));
  }

  // =========================
  // 📊 STATS
  // =========================
}