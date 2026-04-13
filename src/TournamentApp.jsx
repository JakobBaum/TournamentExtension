import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TournamentDB } from "./TournamentDB";
import { Logik } from "./Logik";
import { AutodartsApi } from "./AutodartsApi";
import ExcelJS from "exceljs";
import toast, { Toaster } from "./toast";
const db = new TournamentDB();
const logic = new Logik();
const autodartsApi = new AutodartsApi();

function handleAutodartsApiError(error, fallbackMessage) {
  console.error(error);

  if (error?.code === "TOKEN_REFRESH_REQUIRED") {
    toast.error("Dein Autodarts-Login ist abgelaufen oder ungültig\nBitte lade die Seite neu");
    return true;
  }

  if (fallbackMessage) {
    toast.error(fallbackMessage);
    return true;
  }

  return false;
}

const SCORE_OPTIONS = [121, 170, 301, 501, 701, 901];
const MODE_OPTIONS = ["Straight", "Double", "Master"];
const MAX_ROUNDS_OPTIONS = [15, 20, 50, 80];
const BULL_MODE_OPTIONS = ["25/50", "50/50"];
const BULL_OFF_OPTIONS = ["Off", "Normal", "Official"];
const MATCH_MODE_OPTIONS = ["Legs", "Sets"];
const GROUP_SIZE_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 24, 32];
const QUALIFIER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 16, 32];
const LEGS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SETS_OPTIONS = [2, 3, 4, 5, 6, 7];
const LEGS_OF_SET_OPTIONS = [2, 3];
const TOURNAMENT_TYPE_OPTIONS = ["X01", "Cricket"];
const CRICKET_SCORING_OPTIONS = ["Standard", "Cut Throat", "No Score"];
const CRICKET_GAME_MODE_OPTIONS = ["Cricket", "Tactics"];

const DEFAULT_TOURNAMENT_TYPE = "X01";
const DEFAULT_CRICKET_SETTINGS = {
  scoringMode: "Standard",
  maxRounds: 50,
  bullOffMode: "Off",
  matchMode: "Legs",
  legs: 2,
  sets: 3,
  legsOfSet: 3,
};
/*
const DEFAULT_PLAYERS = [
  "Anna",
  "Bernd",
  "Christian",
  "Doris",
  "Erika",
  "Frank",
  "Gabi",
  "Hans",
  "Ingrid",
  "Jürgen",
  "Karin",
  "Lars",
  "Monika",
  "Norbert",
  "Olga",
  "Peter",
  "Petra",
  "Ralf",
  "Sabine",
  "Thomas",
  "Ursula",
  "Volker",
  "Waltraud",
  "Xaver",
  "Yvonne",
  "Zoe",
  "Alexander",
  "Beate",
  "Claus",
  "Diana",
  "Erich",
  "Frieda",
  "Gerhard",
  "Hilde",
  "Igor",
  "Jutta",
  "Karl",
  "Lisa",
  "Manfred",
  "Nina",
  "Otto",
  "Paula",
  "Quirin",
  "Renate",
  "Stefan",
  "Tanja",
  "Uwe",
  "Verena",
  "Wolfgang",
  "Yasin",
];
*/
const DEFAULT_PLAYERS = [
  "Anna",
  "Bernd",
  "Christian",
  "Doris",
  "Erika",
  "Frank",
  "Gabi",
  "Hans",
  "Ingrid",
];
const activeMatchWatchers = new Set();
const cancelledMatchWatchers = new Set();
const LAST_TOURNAMENT_STORAGE_KEY = "adTournamentLastTournamentId";
const RECENT_TOURNAMENTS_STORAGE_KEY = "recentTournaments";
const MAX_RECENT_TOURNAMENTS = 10;
const DEFAULT_MATCH_SETTINGS = {
  tournamentType: DEFAULT_TOURNAMENT_TYPE,
  baseScore: 501,
  inMode: "Straight",
  outMode: "Double",
  maxRounds: 50,
  bullMode: "25/50",
  bullOffMode: "Normal",
  matchMode: "Legs",
  legs: 3,
  sets: 3,
  legsOfSet: 3,
  scoringMode: "Standard",
  cricketGameMode: "Cricket",
};
const DEFAULT_TOURNAMENT_FORMAT = {
  groupSize: 4,
  qualifiers: 2,
  playAllPlaces: false,
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

const isRealPlayer = (player) => player && typeof player === "object" && player.type === "player";
const isBye = (player) => player && typeof player === "object" && player.type === "bye";

function extractMatchSettings(settings = {}) {
  const tournamentType = settings?.tournamentType || settings?.variant || DEFAULT_MATCH_SETTINGS.tournamentType;

  return {
    tournamentType,
    baseScore: Number(settings?.baseScore) || DEFAULT_MATCH_SETTINGS.baseScore,
    inMode: settings?.inMode || DEFAULT_MATCH_SETTINGS.inMode,
    outMode: settings?.outMode || DEFAULT_MATCH_SETTINGS.outMode,
    maxRounds: Number(settings?.maxRounds) || DEFAULT_MATCH_SETTINGS.maxRounds,
    bullMode: settings?.bullMode || DEFAULT_MATCH_SETTINGS.bullMode,
    bullOffMode: settings?.bullOffMode || DEFAULT_MATCH_SETTINGS.bullOffMode,
    matchMode: settings?.matchMode || DEFAULT_MATCH_SETTINGS.matchMode,
    legs: Number(settings?.legs) || DEFAULT_MATCH_SETTINGS.legs,
    sets: Number(settings?.sets) || DEFAULT_MATCH_SETTINGS.sets,
    legsOfSet: Number(settings?.legsOfSet) || DEFAULT_MATCH_SETTINGS.legsOfSet,
    scoringMode: settings?.scoringMode || DEFAULT_MATCH_SETTINGS.scoringMode,
    cricketGameMode:
      settings?.cricketGameMode ||
      DEFAULT_MATCH_SETTINGS.cricketGameMode,
  };
}

function extractTournamentFormatSettings(settings = {}) {
  return {
    groupSize: Number(settings?.groupSize) || DEFAULT_TOURNAMENT_FORMAT.groupSize,
    qualifiers: Number(settings?.qualifiers) || DEFAULT_TOURNAMENT_FORMAT.qualifiers,
    playAllPlaces:
      typeof settings?.playAllPlaces === "boolean"
        ? settings.playAllPlaces
        : DEFAULT_TOURNAMENT_FORMAT.playAllPlaces,
  };
}

function normalizeRoundSettings(roundSettings = {}) {
  return Object.fromEntries(
    Object.entries(roundSettings || {}).map(([roundKey, value]) => [
      String(roundKey),
      extractMatchSettings(value),
    ]),
  );
}

function normalizeTournamentSettings(settings = {}) {
  const root = settings || {};
  return {
    global: extractMatchSettings(root?.defaultMatchSettings || root),
    format: extractTournamentFormatSettings(root?.tournamentFormat || root),
    roundSettings: normalizeRoundSettings(root?.roundSettings || {}),
  };
}

function buildTournamentSettingsPayload(
  globalSettings = {},
  formatSettings = {},
  roundSettings = {},
) {
  const normalizedGlobal = extractMatchSettings(globalSettings);
  const normalizedFormat = extractTournamentFormatSettings(formatSettings);
  const normalizedRoundSettings = normalizeRoundSettings(roundSettings);

  const payload = {
    ...normalizedGlobal,
    ...normalizedFormat,
    variant: normalizedGlobal.tournamentType,
    defaultMatchSettings: normalizedGlobal,
    tournamentFormat: normalizedFormat,
    ...(normalizedGlobal.tournamentType === "Cricket"
      ? {
          cricketGameMode: normalizedGlobal.cricketGameMode,
        }
      : {}),
  };

  if (Object.keys(normalizedRoundSettings).length > 0) {
    payload.roundSettings = normalizedRoundSettings;
  }

  return payload;
}

function areMatchSettingsEqual(a = {}, b = {}) {
  const left = extractMatchSettings(a);
  const right = extractMatchSettings(b);

  return (
    left.tournamentType === right.tournamentType &&
    left.baseScore === right.baseScore &&
    left.inMode === right.inMode &&
    left.outMode === right.outMode &&
    left.maxRounds === right.maxRounds &&
    left.bullMode === right.bullMode &&
    left.bullOffMode === right.bullOffMode &&
    left.matchMode === right.matchMode &&
    left.legs === right.legs &&
    left.sets === right.sets &&
    left.legsOfSet === right.legsOfSet &&
    left.scoringMode === right.scoringMode &&
    left.cricketGameMode === right.cricketGameMode
  );
}

function pruneRoundSettings(roundSettings = {}, globalSettings = {}) {
  const normalizedGlobal = extractMatchSettings(globalSettings);

  return Object.fromEntries(
    Object.entries(normalizeRoundSettings(roundSettings)).filter(([, value]) => {
      return !areMatchSettingsEqual(value, normalizedGlobal);
    }),
  );
}

function getEffectiveMatchSettings(match, globalSettings, roundSettings = {}) {
  const roundOverride = roundSettings?.[String(match?.round)] || null;
  return extractMatchSettings({
    ...extractMatchSettings(globalSettings),
    ...(roundOverride || {}),
  });
}

function getDisplayName(player) {
  if (!player) return "—";

  if (typeof player === "string") {
    if (player === "__BYE__") return "Freilos";
    if (!Number.isNaN(Number(player))) return `Sieger Spiel ${player}`;
    return player;
  }

  if (player.type === "bye") return "Freilos";
  if (player.type === "player") return player.name || "—";
  if (player.type === "match") {
    const sourceLabel = player.source === "loser" ? "Verlierer" : "Sieger";
    return `${sourceLabel} Spiel ${player.ref}`;
  }
  if (player.type === "qualifier") return player.ref;
  if (player.name) return player.name;

  return "—";
}

function getMatchTitle(match, labelPrefix = "") {
  if (!match) return "Spiel";

  const roundName = String(match.displayRoundName || "").trim();
  const matchNumber = String(match.matchNumber || "").trim();

  const matchNumberLabel = `${labelPrefix || "Spiel"} ${matchNumber}`;

  const isGroupMatch = /^[A-Z]-\d+$/i.test(matchNumber);
  const isGroupRound = /^Gruppe\s+[A-Z]$/i.test(roundName);

  // 👉 Gruppenspiele bleiben wie sie sind
  if (isGroupMatch && isGroupRound) {
    return matchNumberLabel;
  }

  // 👉 NEU: Erste KO Runde → nur "Spiel X"
  if (
    match.bracketType === "main" && // KO Baum
    Number(match.round) === 1       // erste Runde
  ) {
    return matchNumberLabel;
  }

  if (!roundName) {
    return matchNumberLabel;
  }

  const shouldSwapOrder =
    /^Plätze\s+\d+\s*-\s*\d+$/i.test(roundName) ||
    /^Platz\s+\d+$/i.test(roundName);

  if (shouldSwapOrder) {
    return `${matchNumberLabel} – ${roundName}`;
  }

  return `${roundName} – ${matchNumberLabel}`;
}

function formatStatValue(value, digits = 1) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(digits) : (0).toFixed(digits);
}

function isCricketSettings(settings = {}) {
  return extractMatchSettings(settings).tournamentType === "Cricket";
}

function getTournamentTypeLabel(value) {
  return value === "Cricket" ? "Cricket" : "X01";
}

function getFinalStatsColumns(matchMode,tournamentType = DEFAULT_TOURNAMENT_TYPE) {
  if (tournamentType === "Cricket") {
    return [
      { header: "Platz", key: "place", width: 8 },
      { header: "Spieler", key: "name", width: 20 },
      { header: "Siege", key: "wins", width: 10 },
      { header: "Niederlagen", key: "losses", width: 12 },
             ...(matchMode === "Sets"
    ? [{ header: "Sets", key: "sets", width: 12 }]
    : []),
      { header: "Legs", key: "legs", width: 12 },
      { header: "MPR", key: "mpr", width: 10 },
      { header: "First 9 MPR", key: "first9Mpr", width: 14 },
      { header: "5 Mark", key: "mark5", width: 10 },
      { header: "6 Mark", key: "mark6", width: 10 },
      { header: "7 Mark", key: "mark7", width: 10 },
      { header: "8 Mark", key: "mark8", width: 10 },
      { header: "9 Mark", key: "mark9", width: 10 },
      { header: "White Horse", key: "whiteHorse", width: 14 },
    ];
  }

  return [
    { header: "Platz", key: "place", width: 8 },
    { header: "Spieler", key: "name", width: 20 },
    { header: "Siege", key: "wins", width: 10 },
    { header: "Niederlagen", key: "losses", width: 12 },
    { header: "Legs", key: "legs", width: 12 },
    { header: "Sets", key: "sets", width: 12 },
    { header: "Average", key: "avg", width: 10 },
    { header: "Checkout %", key: "co", width: 12 },
    { header: "60+", key: "p60", width: 8 },
    { header: "100+", key: "p100", width: 8 },
    { header: "140+", key: "p140", width: 8 },
    { header: "170+/180", key: "p180", width: 12 },
    { header: "Bestes Checkout", key: "best", width: 18 },
  ];
}

function getFinalStatsRow(player, index,matchMode, tournamentType = DEFAULT_TOURNAMENT_TYPE) {
  const row = {
    place: player.finalPlace ?? index + 1,
    name: player.name,
    wins: Number(player.wins || 0),
    losses: Number(player.losses || 0),
 ...(matchMode === "Sets"
    ? { sets: `${player.setsWon || 0}:${player.setsLost || 0}` }
    : {}),
    legs: `${player.legsWon || 0}:${player.legsLost || 0}`,
  };

  if (tournamentType === "Cricket") {
    return {
      ...row,
      mpr: formatStatValue(player.mpr, 2),
      first9Mpr: formatStatValue(player.first9MPR, 2),
      mark5: Number(player.mark5 || 0),
      mark6: Number(player.mark6 || 0),
      mark7: Number(player.mark7 || 0),
      mark8: Number(player.mark8 || 0),
      mark9: Number(player.mark9 || 0),
      whiteHorse: Number(player.whiteHorse || 0),
    };
  }

  return {
    ...row,
    avg: formatStatValue(player.average, 1),
    co: formatStatValue(player.checkoutPercent, 1),
    p60: Number(player.plus60 || 0),
    p100: Number(player.plus100 || 0),
    p140: Number(player.plus140 || 0),
    p180: Number(player.plus170Or180 || 0),
    best: Number(player.bestCheckout || 0),
  };
}

function extractFinalPlayerStatsFromAutodartsStats(stats) {
  const players = stats?.players || [];
  const matchStats = stats?.matchStats || [];

  return matchStats.map((entry, index) => ({
    name: players[index]?.name || null,
    stats: entry || null,
    index,
    isWinner: stats?.winner === index,
  }));
}

function extractMatchResultFromStats(stats, match) {
  const winnerIndex = stats?.winner;

  if (typeof winnerIndex !== "number") {
    throw new Error("Kein Sieger in den Match-Stats gefunden");
  }

  const winnerPlayer = stats?.players?.[winnerIndex];
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  const loserPlayer = stats?.players?.[loserIndex] || null;

  if (!winnerPlayer) {
    throw new Error("Sieger konnte nicht aus den Match-Stats gelesen werden");
  }

  const normalizePlayer = (matchPlayer, statsPlayer) => {
    if (!matchPlayer) return null;

    return {
      ...matchPlayer,
      name: statsPlayer?.name || matchPlayer.name || "—",
    };
  };

  let winner = null;
  let loser = null;

  if (match?.player1?.name === winnerPlayer.name) {
    winner = normalizePlayer(match.player1, winnerPlayer);
    loser = normalizePlayer(match.player2, loserPlayer);
  } else if (match?.player2?.name === winnerPlayer.name) {
    winner = normalizePlayer(match.player2, winnerPlayer);
    loser = normalizePlayer(match.player1, loserPlayer);
  } else {
    winner = {
      type: "player",
      id: null,
      name: winnerPlayer.name,
      groupId: null,
    };

    loser = loserPlayer
      ? {
          type: "player",
          id: null,
          name: loserPlayer.name,
          groupId: null,
        }
      : null;
  }

  return { winner, loser };
}

function getPlayerScore(match, slot, matchMode = "Legs") {
  if (!match) return null;

  const score = slot === "player1" ? match.scorePlayer1 : match.scorePlayer2;
  if (score === null || score === undefined) return null;

  if (typeof score === "object") {
    const sets = typeof score.sets === "number" ? score.sets : 0;
    const legs = typeof score.legs === "number" ? score.legs : 0;
    return matchMode === "Sets" ? `${sets}:${legs}` : String(legs);
  }

  if (typeof score === "number" || typeof score === "string") {
    return String(score);
  }

  return null;
}

function getManualEditTargetWins(match, globalSettings, roundSettings = {}) {
  const effectiveSettings = getEffectiveMatchSettings(match, globalSettings, roundSettings);
  return effectiveSettings.matchMode === "Sets"
    ? Number(effectiveSettings.sets) || DEFAULT_MATCH_SETTINGS.sets
    : Number(effectiveSettings.legs) || DEFAULT_MATCH_SETTINGS.legs;
}

function getManualEditScoreLabel(match, globalSettings, roundSettings = {}) {
  const effectiveSettings = getEffectiveMatchSettings(match, globalSettings, roundSettings);
  return effectiveSettings.matchMode === "Sets" ? "Sets" : "Legs";
}

function validateManualMatchResult(
  match,
  winnerSlot,
  rawScore1,
  rawScore2,
  globalSettings,
  roundSettings = {},
) {
  if (!match) {
    return { valid: false, message: "Kein Spiel ausgewählt." };
  }

  const targetWins = getManualEditTargetWins(match, globalSettings, roundSettings);
  const scoreLabel = getManualEditScoreLabel(match, globalSettings, roundSettings);
  const score1 = Number(rawScore1);
  const score2 = Number(rawScore2);

  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, message: `Bitte nur ganze ${scoreLabel}-Zahlen eingeben.` };
  }

  if (score1 < 0 || score2 < 0) {
    return { valid: false, message: `${scoreLabel} dürfen nicht negativ sein.` };
  }

  if (score1 === score2) {
    return { valid: false, message: `Ein Spiel kann nicht mit Gleichstand gespeichert werden.` };
  }

  const winnerScore = winnerSlot === "player1" ? score1 : score2;
  const loserScore = winnerSlot === "player1" ? score2 : score1;

  if (winnerScore !== targetWins) {
    return {
      valid: false,
      message: `Der Sieger muss genau ${targetWins} ${scoreLabel} haben.`,
    };
  }

  if (loserScore >= targetWins) {
    return {
      valid: false,
      message: `Der Verlierer darf maximal ${targetWins - 1} ${scoreLabel} haben.`,
    };
  }

  return {
    valid: true,
    score1,
    score2,
    targetWins,
    scoreLabel,
  };
}

function compareMatchNumbers(a, b) {
  const parseMatchNumber = (value) => {
    const str = String(value);

    const groupMatch = str.match(/^([A-Z])-(\d+)$/);
    if (groupMatch) {
      return {
        type: "group",
        group: groupMatch[1].charCodeAt(0),
        num: Number(groupMatch[2]),
      };
    }

    if (!Number.isNaN(Number(str))) {
      return {
        type: "ko",
        group: 999,
        num: Number(str),
      };
    }

    return {
      type: "other",
      group: 9999,
      num: 9999,
    };
  };

  const parsedA = parseMatchNumber(a);
  const parsedB = parseMatchNumber(b);

  if (parsedA.group !== parsedB.group) {
    return parsedA.group - parsedB.group;
  }

  return parsedA.num - parsedB.num;
}

function sortMatchesByMatchNumber(matches) {
  return [...matches].sort((a, b) => compareMatchNumbers(a.matchNumber, b.matchNumber));
}

function groupMatchesByRound(matches) {
  const roundMap = new Map();

  for (const match of matches) {
    const roundKey = String(match.round);
    if (!roundMap.has(roundKey)) {
      roundMap.set(roundKey, []);
    }
    roundMap.get(roundKey).push(match);
  }

  return [...roundMap.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([round, roundMatches]) => ({
      round: Number(round),
      matches: roundMatches,
    }));
}

function buildGroupTables(matches = [], groups = [], qualifiedPerGroup = 2) {
  const groupMatches = matches.filter((match) => !!match.group);
  const groupNames = [
    ...new Set([
      ...groupMatches.map((match) => match.group).filter(Boolean),
      ...groups.map((group) => group?.name).filter(Boolean),
    ]),
  ];

  return groupNames.map((groupName) => {
    const matchesOfGroup = sortMatchesByMatchNumber(
      groupMatches.filter((match) => match.group === groupName),
    );

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
          player,
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

    for (const match of matchesOfGroup) {
      ensurePlayer(match.player1);
      ensurePlayer(match.player2);

      if (match.status !== "finished") continue;
      if (match.player1?.type !== "player" || match.player2?.type !== "player") continue;

      const entry1 = ensurePlayer(match.player1);
      const entry2 = ensurePlayer(match.player2);
      if (!entry1 || !entry2) continue;

      entry1.played += 1;
      entry2.played += 1;

      const score1 = Number(match.scorePlayer1?.legs ?? match.scorePlayer1 ?? 0) || 0;
      const score2 = Number(match.scorePlayer2?.legs ?? match.scorePlayer2 ?? 0) || 0;
      const sets1 = Number(match.scorePlayer1?.sets ?? 0) || 0;
      const sets2 = Number(match.scorePlayer2?.sets ?? 0) || 0;

      entry1.legsWon += score1;
      entry1.legsLost += score2;
      entry2.legsWon += score2;
      entry2.legsLost += score1;

      entry1.setsWon += sets1;
      entry1.setsLost += sets2;
      entry2.setsWon += sets2;
      entry2.setsLost += sets1;

      const winnerKey = String(match.winner?.id || match.winner?.name || "")
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

    const standings = [...table.values()]
      .map((entry) => ({
        ...entry,
        legDiff: entry.legsWon - entry.legsLost,
        setDiff: entry.setsWon - entry.setsLost,
      }))
      .sort((a, b) => {
        const pointsDiff = b.points - a.points;
        if (pointsDiff !== 0) return pointsDiff;

        const winsDiff = b.wins - a.wins;
        if (winsDiff !== 0) return winsDiff;

        const legDiff = b.legDiff - a.legDiff;
        if (legDiff !== 0) return legDiff;

        const legsWonDiff = b.legsWon - a.legsWon;
        if (legsWonDiff !== 0) return legsWonDiff;

        const setDiff = b.setDiff - a.setDiff;
        if (setDiff !== 0) return setDiff;

        return String(a.player?.name || "").localeCompare(String(b.player?.name || ""), "de", {
          sensitivity: "base",
        });
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        isQualified: index < qualifiedPerGroup,
      }));

    const finishedMatches = matchesOfGroup.filter((match) => match.status === "finished").length;

    return {
      name: groupName,
      matches: matchesOfGroup,
      standings,
      totalMatches: matchesOfGroup.length,
      finishedMatches,
      isComplete: matchesOfGroup.length > 0 && finishedMatches === matchesOfGroup.length,
    };
  });
}

function isTournamentFinished(matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) return false;
  return matches.every((match) => match.status === "finished");
}

function readRecentTournamentIds() {
  try {
    const raw = localStorage.getItem(RECENT_TOURNAMENTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((value) => String(value || "").trim())
      .filter(Boolean);
  } catch (error) {
    console.warn("Recent tournaments could not be read from localStorage.", error);
    return [];
  }
}

function writeRecentTournamentIds(ids = []) {
  try {
    const normalized = [...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    )].slice(0, MAX_RECENT_TOURNAMENTS);

    localStorage.setItem(RECENT_TOURNAMENTS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn("Recent tournaments could not be written to localStorage.", error);
    return [];
  }
}

function rememberRecentTournament(tournamentId) {
  const normalizedId = String(tournamentId || "").trim();
  if (!normalizedId) return [];

  const currentIds = readRecentTournamentIds().filter((id) => id !== normalizedId);
  return writeRecentTournamentIds([normalizedId, ...currentIds]);
}

function removeRecentTournament(tournamentId) {
  const normalizedId = String(tournamentId || "").trim();
  if (!normalizedId) return readRecentTournamentIds();

  const nextIds = readRecentTournamentIds().filter((id) => id !== normalizedId);
  return writeRecentTournamentIds(nextIds);
}

function sortPlayersForFinalTable(players = []) {
  return [...players].sort((a, b) => {
    const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
    if (pointsDiff !== 0) return pointsDiff;

    const winsDiff = Number(b.wins || 0) - Number(a.wins || 0);
    if (winsDiff !== 0) return winsDiff;

    const legsDiffA = Number(a.legsWon || 0) - Number(a.legsLost || 0);
    const legsDiffB = Number(b.legsWon || 0) - Number(b.legsLost || 0);
    if (legsDiffB !== legsDiffA) return legsDiffB - legsDiffA;

    const setsDiffA = Number(a.setsWon || 0) - Number(a.setsLost || 0);
    const setsDiffB = Number(b.setsWon || 0) - Number(b.setsLost || 0);
    if (setsDiffB !== setsDiffA) return setsDiffB - setsDiffA;

    const x01Diff = Number(b.average || 0) - Number(a.average || 0);
    if (x01Diff !== 0) return x01Diff;

    return Number(b.mpr || 0) - Number(a.mpr || 0);
  });
}

function canStartMatch(match) {
  if (!match || match.status !== "pending") return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

function isLiveMatch(match) {
  return !!match && ["started", "live", "running"].includes(match.status);
}

function canGiveUp(match) {
  if (!match || match.status === "finished" || isLiveMatch(match)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

function canEditResult(match) {
  if (!match || !["finished", "aborted"].includes(match.status)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

function canRestartMatch(match) {
  if (!match || !["finished", "aborted"].includes(match.status)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

function isDoubleByeMatch(match) {
  return match?.player1?.type === "bye" && match?.player2?.type === "bye";
}

function getStatusLabel(matchOrStatus) {
  if (typeof matchOrStatus === "object" && isDoubleByeMatch(matchOrStatus)) {
    return "Freilose";
  }

  const status = typeof matchOrStatus === "string" ? matchOrStatus : matchOrStatus?.status;

  if (status === "finished") return "Fertig";
  if (status === "aborted") return "Abgebrochen";
  if (status === "started" || status === "live" || status === "running") return "Live";
  if (status === "pending") return "Offen";
  return status || "Unbekannt";
}

function getMatchResultLabel(match) {
  if (!match) return "Ergebnis";

  if (isDoubleByeMatch(match)) {
    return "Freilose";
  }

  if (match?.status === "finished") {
    if (typeof match?.winnerPlace === "number" && match?.winner?.type === "player") {
      return `Platz ${match.winnerPlace}`;
    }

    if (match?.winner?.type === "player") {
      return "Sieger";
    }
  }

  return "Sieger";
}

function getStatusClass(status) {
  if (status === "finished") return "status-finished";
  if (status === "aborted") return "status-default";
  if (status === "started" || status === "live" || status === "running") return "status-live";
  if (status === "pending") return "status-pending";
  return "status-default";
}

async function watchMatchUntilFinished({
  tournamentId,
  match,
  boardDocId,
  lobbyId,
  intervalMs = 4000,
  timeoutMs = 1000 * 60 * 60 * 4,
}) {
  if (!tournamentId || !match?.id || !lobbyId) return;

  const watcherKey = `${tournamentId}:${match.id}`;

  cancelledMatchWatchers.delete(watcherKey);
  if (activeMatchWatchers.has(watcherKey)) return;

  activeMatchWatchers.add(watcherKey);
  const startedAt = Date.now();

  const stopWatching = () => {
    activeMatchWatchers.delete(watcherKey);
    cancelledMatchWatchers.delete(watcherKey);
  };

  const tick = async () => {
    if (cancelledMatchWatchers.has(watcherKey)) {
      stopWatching();
      return;
    }

    if (Date.now() - startedAt > timeoutMs) {
      console.warn("Match watcher timeout:", lobbyId);
      stopWatching();
      return;
    }

    try {
      const stats = await autodartsApi.getMatchStats(lobbyId);

      if (!stats) {
        setTimeout(tick, intervalMs);
        return;
      }

      const scorePlayer1 = stats?.scores?.[0] ?? null;
      const scorePlayer2 = stats?.scores?.[1] ?? null;

      await db.saveMatchScore(tournamentId, match.id, {
        lobbyId,
        boardId: match.boardId || null,
        scorePlayer1,
        scorePlayer2,
      });

      if (stats?.finishedAt == null) {
        setTimeout(tick, intervalMs);
        return;
      }

      const result = extractMatchResultFromStats(stats, match);

      await db.setMatchFinished(tournamentId, match.id, result.winner, result.loser, {
        lobbyId,
        boardId: match.boardId || null,
        scorePlayer1,
        scorePlayer2,
        finalPlayerStats: extractFinalPlayerStatsFromAutodartsStats(stats),
        finishedAt: stats?.finishedAt || new Date().toISOString(),
        resultSource: "autodarts",
      });

      if (boardDocId) {
        await db.releaseBoard(tournamentId, boardDocId);
      }

      stopWatching();
    } catch (error) {
      console.error("watchMatchUntilFinished error", error);

      if (error?.code === "TOKEN_REFRESH_REQUIRED") {
        toast.error("Dein Autodarts-Login ist abgelaufen oder ungültig\nBitte lade die Seite neu");
        stopWatching();
        return;
      }

      setTimeout(tick, intervalMs);
    }
  };

  tick();
}

function CollapsibleSection({
  title,
  subtitle,
  badge = null,
  defaultOpen = true,
  actions = null,
  className = "",
  children,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className={`collapsible-section ${className} ${isOpen ? "is-open" : "is-closed"}`.trim()}>
      <button type="button" className="collapse-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <div className="collapse-toggle-left">
          <span className={`collapse-chevron ${isOpen ? "open" : ""}`}>▾</span>
          <div className="collapse-title-wrap">
            <strong>{title}</strong>
            {subtitle && <span className="section-subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="collapse-toggle-right">
          {badge !== null && <span className="group-block-count">{badge}</span>}
          {actions ? <span className="collapse-inline-actions">{actions}</span> : null}
        </div>
      </button>

      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

function RoundSection({ title, subtitle, badge, defaultOpen = false, actions = null, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className={`round-section ${isOpen ? "is-open" : "is-closed"}`}>
      <button
        type="button"
        className="round-section-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="round-section-toggle-left">
          <span className={`round-section-chevron ${isOpen ? "open" : ""}`}>▾</span>
          <div className="round-section-title-wrap">
            <strong>{title}</strong>
            {subtitle ? <span className="round-section-subtitle">{subtitle}</span> : null}
          </div>
        </div>

        <div className="round-section-toggle-right">
          {badge ? <span className="round-section-badge">{badge}</span> : null}
          {actions ? <span className="collapse-inline-actions">{actions}</span> : null}
        </div>
      </button>

      {isOpen ? <div className="round-section-content">{children}</div> : null}
    </div>
  );
}

function GroupStandingsTable({ standings, qualifiedPerGroup,matchMode }) {
  if (!standings?.length) return null;

  return (
    <div className="group-standings-card">
      <div className="group-standings-head">
        <strong>Tabelle</strong>
        <span>{qualifiedPerGroup} Qualifikanten</span>
      </div>

      <div className="group-standings-table-wrap">
        <table className="group-standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spieler</th>
              <th>Sp</th>
              <th>S</th>
              <th>N</th>
              <th>Pkte</th>
              {matchMode === "Legs" && (<th>Legs</th>)}
              {matchMode === "Sets" && (<th>Sets</th>)}
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => (
              <tr key={entry.key} className={entry.isQualified ? "qualified-row" : ""}>
                <td>{entry.rank}</td>
                <td>
                  <div className="group-player-cell">
                    <span>{entry.player?.name || "—"}</span>
                    {entry.rank <= qualifiedPerGroup && <span className="qualified-badge">Q</span>}
                  </div>
                </td>
                <td>{entry.played}</td>
                <td>{entry.wins}</td>
                <td>{entry.losses}</td>
                <td>{entry.points}</td>
                {matchMode === "Sets" ?(<><td>
                  {entry.legsWon}:{entry.legsLost}
                </td>
                <td>{entry.legDiff > 0 ? `+${entry.legDiff}` : entry.legDiff}</td></>):
                (<><td>
                  {entry.setsWon}:{entry.setsLost}
                </td>
                <td>{entry.setDiff > 0 ? `+${entry.setDiff}` : entry.setDiff}</td></>)
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchPlayerRow({ match, slot, matchMode, onGiveUpMatch }) {
  const player = slot === "player1" ? match.player1 : match.player2;
  const score = getPlayerScore(match, slot, matchMode);
  const isDoubleBye = match?.player1?.type === "bye" && match?.player2?.type === "bye";

  const isWinner = !isDoubleBye && match?.winner && player && match.winner === player;

  return (
    <div className={cx("player-row", "compact-player-row", isWinner && "winner-row")}>
      <div className="player-row-main">
        <span className="player-name-text">{getDisplayName(player)}</span>
        {isWinner && <span className="winner-badge">Sieger</span>}
      </div>

      <div className="player-row-actions">
        {score !== null && <span className="player-score">{score}</span>}
        {canGiveUp(match) && (
          <button
            type="button"
            className="btn btn--danger btn--xs"
            onClick={() => onGiveUpMatch(match, slot)}
          >
            Aufgeben
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  matchMode,
  onStartMatch,
  onGiveUpMatch,
  onEditResult,
  onRestartMatch,
  onAbortLiveMatch,
  labelPrefix = "",
}) {
  return (
    <div
      className="match-card compact-card match-card-enhanced"
      key={`${labelPrefix}${match.matchNumber}`}
    >
      <div className="match-head">
        <div className="match-title-stack">
          <span className="match-number">{getMatchTitle(match, labelPrefix)}</span>
          {match.group && <span className="match-subline">{match.group}</span>}
        </div>

        <span className={`status-pill ${getStatusClass(match.status)}`}>
          {getStatusLabel(match)}
        </span>
      </div>

      {(match?.manuallyCorrectedAt || match?.resultSource === "manual") && (
        <div className="match-subline match-subline--manual">Ergebnis manuell überschrieben</div>
      )}

      <div className="match-body">
        <MatchPlayerRow
          match={match}
          slot="player1"
          matchMode={matchMode}
          onGiveUpMatch={onGiveUpMatch}
        />
        <MatchPlayerRow
          match={match}
          slot="player2"
          matchMode={matchMode}
          onGiveUpMatch={onGiveUpMatch}
        />
      </div>

      <div className="match-foot">
        <span>{getMatchResultLabel(match)}</span>
        <span>{getDisplayName(match.winner)}</span>
      </div>

      <div className="match-card-actions">
        {canStartMatch(match) && (
          <button
            className="btn btn--primary btn--compact btn--full"
            onClick={() => onStartMatch(match)}
          >
            Starten
          </button>
        )}

        {isLiveMatch(match) && match.lobbyId && (
          <>
            <button
              className="btn btn--secondary btn--compact open-match"
              onClick={() => {
                const matchUrl = `https://play.autodarts.io/matches/${match.lobbyId}`;
                window.open(matchUrl, "_blank", "noopener,noreferrer");
              }}
            >
              Spiel öffnen
            </button>

            <button
              className="btn btn--secondary btn--compact"
              onClick={() => onAbortLiveMatch(match)}
            >
              Abbrechen
            </button>
          </>
        )}

        {canRestartMatch(match) && (
          <button className="btn btn--secondary btn--compact" onClick={() => onRestartMatch(match)}>
            Spiel neu starten
          </button>
        )}

        {canEditResult(match) && (
          <button className="btn btn--secondary btn--compact" onClick={() => onEditResult(match)}>
            {match.status === "aborted" ? "Ergebnis eingeben" : "Ergebnis korrigieren"}
          </button>
        )}
      </div>
    </div>
  );
}

function BoardOverview({ boards, matches, onReleaseBoard }) {
  if (!boards?.length) return null;

  const getMatchLabel = (match) => {
    if (!match) return "Kein Spiel";
    return `Spiel ${match.matchNumber}: ${getDisplayName(match.player1)} vs. ${getDisplayName(match.player2)}`;
  };

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Boards"
        subtitle="Live-Zuordnung und manuelle Freigabe"
        badge={`${boards.length} Boards`}
        defaultOpen={false}
      >
        <div className="group-match-grid board-grid">
          {boards.map((board) => {
            const currentMatch = matches.find((match) => match.id === board.currentMatchId);
            const isBusy = board.status !== "free" || !!board.currentMatchId;

            return (
              <div key={board.id} className="match-card compact-card board-card">
                <div className="match-head">
                  <div className="match-title-stack">
                    <span className="board-name">{board.name || board.boardId || board.id}</span>
                    <span className="match-subline">Board</span>
                  </div>

                  <span className={`status-pill ${isBusy ? "status-live" : "status-finished"}`}>
                    {isBusy ? "Belegt" : "Frei"}
                  </span>
                </div>

                <div className="board-meta-list">
                  <div className="board-meta-row">
                    <span>Board-ID</span>
                    <span>{board.boardId || board.id}</span>
                  </div>

                  <div className="board-meta-row">
                    <span>Aktuelles Spiel</span>
                    <span>{getMatchLabel(currentMatch)}</span>
                  </div>
                </div>

                {isBusy && (
                  <button
                    className="btn btn--secondary btn--compact"
                    onClick={() => onReleaseBoard(board, currentMatch)}
                  >
                    Manuell freigeben
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function OverviewStats({ matches, boards, playersCount, mode }) {
  const totalMatches = matches.length;
  const finishedMatches = matches.filter((m) => m.status === "finished").length;
  const liveMatches = matches.filter((m) =>
    ["started", "live", "running"].includes(m.status),
  ).length;
  const pendingMatches = matches.filter((m) => m.status === "pending").length;

  const totalBoards = boards.length;
  const freeBoardCount = boards.filter((b) => !b.currentMatchId && b.status === "free").length;
  const busyBoards = totalBoards - freeBoardCount;

  const cards = [
    { label: "Spieler", value: playersCount },
    { label: "Modus", value: mode === "KO" ? "KO" : "Gruppen + KO" },
    { label: "Spiele gesamt", value: totalMatches },
    { label: "Offen", value: pendingMatches },
    { label: "Live", value: liveMatches },
    { label: "Fertig", value: finishedMatches },
    { label: "Freie Boards", value: freeBoardCount },
    { label: "Belegte Boards", value: busyBoards },
  ];

  return (
    <CollapsibleSection
      title="Übersicht"
      subtitle="Turnier- und Boardstatus auf einen Blick"
      badge={`${totalMatches} Spiele`}
      className="overview-collapsible"
      defaultOpen={false}
    >
      <div className="overview-stats-grid">
        {cards.map((card) => (
          <div className="overview-stat-card" key={card.label}>
            <div className="overview-stat-label">{card.label}</div>
            <div className="overview-stat-value">{card.value}</div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function buildFinalPlacements(matches = [], players = []) {
  const placements = new Map();

  for (const match of matches) {
    if (match?.status !== "finished") continue;

    if (
      typeof match?.winnerPlace === "number" &&
      match?.winner?.type === "player" &&
      match?.winner?.name
    ) {
      placements.set(String(match.winner.name).trim().toLowerCase(), match.winnerPlace);
    }

    if (
      typeof match?.loserPlace === "number" &&
      match?.loser?.type === "player" &&
      match?.loser?.name
    ) {
      placements.set(String(match.loser.name).trim().toLowerCase(), match.loserPlace);
    }
  }

  const sortedByStats = sortPlayersForFinalTable(players);
  const statsOrderMap = new Map(
    sortedByStats.map((player, index) => [
      String(player.name || "")
        .trim()
        .toLowerCase(),
      index,
    ]),
  );

  return [...players]
    .map((player) => ({
      ...player,
      finalPlace:
        placements.get(
          String(player.name || "")
            .trim()
            .toLowerCase(),
        ) ?? null,
    }))
    .sort((a, b) => {
      const aPlaced = typeof a.finalPlace === "number";
      const bPlaced = typeof b.finalPlace === "number";

      if (aPlaced && bPlaced) return a.finalPlace - b.finalPlace;
      if (aPlaced) return -1;
      if (bPlaced) return 1;

      const aOrder =
        statsOrderMap.get(
          String(a.name || "")
            .trim()
            .toLowerCase(),
        ) ?? Number.MAX_SAFE_INTEGER;
      const bOrder =
        statsOrderMap.get(
          String(b.name || "")
            .trim()
            .toLowerCase(),
        ) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

function FinalStandingsTable({ matches, players, tournamentName, tournamentType,matchMode }) {
  async function exportToExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Ergebnisse");

    worksheet.columns = getFinalStatsColumns(matchMode,tournamentType);

    sortedPlayers.forEach((player, index) => {
      worksheet.addRow(getFinalStatsRow(player, index,matchMode, tournamentType));
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${tournamentName || "Turnier"}_Ergebnisse.xlsx`;
    link.click();
  }
  const tournamentFinished = useMemo(() => isTournamentFinished(matches), [matches]);

  const hasRealPlacements = useMemo(
    () =>
      matches.some(
        (match) =>
          match?.status === "finished" &&
          (typeof match?.winnerPlace === "number" || typeof match?.loserPlace === "number"),
      ),
    [matches],
  );

  const sortedPlayers = useMemo(() => {
    if (hasRealPlacements) {
      return buildFinalPlacements(matches, players);
    }

    return sortPlayersForFinalTable(players).map((player, index) => ({
      ...player,
      finalPlace: index + 1,
    }));
  }, [hasRealPlacements, matches, players]);

  if (!tournamentFinished || !sortedPlayers.length) return null;

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Abschlusstabelle"
        subtitle={`Endstand von ${tournamentName || "dem Turnier"}`}
        badge={`${sortedPlayers.length} Spieler`}
        defaultOpen={true}
        actions={
          <button
            className="btn btn--secondary btn--xs"
            onClick={(event) => {
              event.stopPropagation();
              exportToExcel();
            }}
          >
            Excel Export
          </button>
        }
      >
        <div className="final-standings-wrap">
          <table className="final-standings-table">
            <thead>
              <tr>
                {getFinalStatsColumns(matchMode,tournamentType).map((column) => (
                  <th key={column.key}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => {
                const rank = player.finalPlace ?? index + 1;
                const highlightClass = rank <= 3 ? "is-highlighted" : "";

                return (
                  <tr key={player.id || player.name}>
                    <td className="final-standings-rank">{rank}</td>
                    <td className="final-standings-player">{player.name}</td>
                    <td className={cx("final-standings-stat", highlightClass)}>
                      {Number(player.wins || 0)}
                    </td>
                    <td className={cx("final-standings-stat", highlightClass)}>
                      {Number(player.losses || 0)}
                    </td>
                     {matchMode === "Sets" && (<td className={cx("final-standings-stat", highlightClass)}>
                      {Number(player.setsWon || 0)} / {Number(player.setsLost || 0)}
                    </td>)}
                    <td className={cx("final-standings-stat", highlightClass)}>
                      {Number(player.legsWon || 0)} / {Number(player.legsLost || 0)}
                    </td>
                   
                    
                    {tournamentType === "Cricket" ? (
                      <>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {formatStatValue(player.mpr, 2)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {formatStatValue(player.first9MPR, 2)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.mark5 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.mark6 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.mark7 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.mark8 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.mark9 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.whiteHorse || 0)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {formatStatValue(player.average, 1)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {formatStatValue(player.checkoutPercent, 1)}%
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.plus60 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.plus100 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.plus140 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.plus170Or180 || 0)}
                        </td>
                        <td className={cx("final-standings-stat", highlightClass)}>
                          {Number(player.bestCheckout || 0)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function TournamentTree({
  matches,
  groups,
  mode,
  matchMode,
  tournamentType,
  qualifiedPerGroup,
  onStartMatch,
  onGiveUpMatch,
  onEditResult,
  onRestartMatch,
  onAbortLiveMatch,
  tournamentId,
  roundSettings,
  onOpenRoundSettings,
  onOpenGlobalSettings,
}) {
  const groupMatches = useMemo(
    () => sortMatchesByMatchNumber(matches.filter((match) => match.group)),
    [matches],
  );

  const groupTables = useMemo(
    () => buildGroupTables(matches, groups, qualifiedPerGroup),
    [matches, groups, qualifiedPerGroup],
  );

  const knockoutMatches = useMemo(() => matches.filter((match) => !match.group), [matches]);

  const groupedRounds = useMemo(() => groupMatchesByRound(knockoutMatches), [knockoutMatches]);

  const [initialGroupPhaseOpen, setInitialGroupPhaseOpen] = useState(true);
  const [initialGroupOpenMap, setInitialGroupOpenMap] = useState({});
  const [initialRoundOpenMap, setInitialRoundOpenMap] = useState({});

  useEffect(() => {
    const groupsPhaseComplete =
      groupTables.length > 0 && groupTables.every((group) => group.isComplete);

    const nextGroupOpenMap = {};
    for (const groupTable of groupTables) {
      nextGroupOpenMap[groupTable.name] = !groupTable.isComplete;
    }

    const firstOpenRoundIndex = groupedRounds.findIndex((roundBlock) =>
      roundBlock.matches.some((match) => match.status !== "finished"),
    );

    const nextRoundOpenMap = {};
    groupedRounds.forEach((roundBlock, index) => {
      nextRoundOpenMap[roundBlock.round] =
        firstOpenRoundIndex !== -1 && index === firstOpenRoundIndex;
    });

    setInitialGroupPhaseOpen(!groupsPhaseComplete);
    setInitialGroupOpenMap(nextGroupOpenMap);
    setInitialRoundOpenMap(nextRoundOpenMap);
  }, [tournamentId, groupTables, groupedRounds]);

  if (!matches?.length) return null;

  return (
    <div className="tree-wrapper">
      {mode === "GROUP_KO" && groupMatches.length > 0 && (
        <div className="tree-section">
          <CollapsibleSection
            title="Gruppenphase"
            subtitle="Alle Gruppenspiele mit aktueller Tabelle"
            badge={`${groupMatches.length} Spiele`}
            defaultOpen={initialGroupPhaseOpen}
          >
            <div className="phase-settings-note">
              Für die Gruppenphase gelten die globalen Spieleinstellungen. Rundeneinstellungen
              gelten nur für die KO-Runden.
            </div>
            <div className="group-sections">
              {groupTables.map((groupTable) => (
                <div className="group-block" key={groupTable.name}>
                  <CollapsibleSection
                    title={groupTable.name}
                    subtitle={`${groupTable.finishedMatches}/${groupTable.totalMatches} Spiele fertig`}
                    badge={groupTable.isComplete ? "Komplett" : "Laufend"}
                    defaultOpen={initialGroupOpenMap[groupTable.name] ?? true}
                  >
                    <div className="group-block-layout">
                      <GroupStandingsTable
                        standings={groupTable.standings}
                        qualifiedPerGroup={qualifiedPerGroup}
                        matchMode={matchMode}
                      />

                      <div className="group-match-grid">
                        {groupTable.matches.map((match) => (
                          <MatchCard
                            key={`group-${match.matchNumber}`}
                            match={match}
                            matchMode={matchMode}
                            onStartMatch={onStartMatch}
                            onGiveUpMatch={onGiveUpMatch}
                            onEditResult={onEditResult}
                            onRestartMatch={onRestartMatch}
                            onAbortLiveMatch={onAbortLiveMatch}
                          />
                        ))}
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      <div className="tree-section">
        <CollapsibleSection
          title={mode === "KO" ? "KO-Phase" : "Finalrunde"}
          subtitle="Runde für Runde im Turnierbaum"
          badge={`${groupedRounds.length} Runden`}
          defaultOpen={true}
        >
          <div className="round-sections">
            {groupedRounds.map((roundBlock) => {
              const roundMatches = sortMatchesByMatchNumber(roundBlock.matches);

              return (
                <RoundSection
                  key={`round-${roundBlock.round}`}
                  title={`Runde ${roundBlock.round}`}
                  subtitle={
                    roundSettings?.[String(roundBlock.round)]
                      ? "Eigene Spieleinstellungen aktiv"
                      : "Spiele dieser Runde"
                  }
                  badge={`${roundMatches.length} ${roundMatches.length === 1 ? "Spiel" : "Spiele"}`}
                  defaultOpen={initialRoundOpenMap[roundBlock.round] ?? false}
                  actions={
                    <span
                      role="button"
                      tabIndex={0}
                      className="btn btn--secondary btn--xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenRoundSettings?.(roundBlock.round);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenRoundSettings?.(roundBlock.round);
                        }
                      }}
                    >
                      Rundeneinstellungen
                    </span>
                  }
                >
                  <div className="round-match-grid">
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={`ko-${match.matchNumber}`}
                        match={match}
                        matchMode={matchMode}
                        onStartMatch={onStartMatch}
                        onGiveUpMatch={onGiveUpMatch}
                        onEditResult={onEditResult}
                        onRestartMatch={onRestartMatch}
                        onAbortLiveMatch={onAbortLiveMatch}
                        labelPrefix="Spiel"
                      />
                    ))}
                  </div>
                </RoundSection>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

export default function TournamentApp() {
  const [tournamentName, setTournamentName] = useState("Mein Turnier");
  const [mode, setMode] = useState("KO");
  const [tournamentType, setTournamentType] = useState(DEFAULT_TOURNAMENT_TYPE);
  const [baseScore, setBaseScore] = useState(501);
  const [inMode, setInMode] = useState("Straight");
  const [outMode, setOutMode] = useState("Double");
  const [maxRounds, setMaxRounds] = useState(50);
  const [bullMode, setBullMode] = useState("25/50");
  const [bullOffMode, setBullOffMode] = useState("Normal");
  const [scoringMode, setScoringMode] = useState("Standard");
  const [cricketGameMode, setCricketGameMode] = useState(DEFAULT_CRICKET_SETTINGS.cricketGameMode);
  const [matchMode, setMatchMode] = useState("Legs");
  const [legs, setLegs] = useState(3);
  const [sets, setSets] = useState(3);
  const [legsOfSet, setLegsOfSet] = useState(3);
  const [groupSize, setGroupSize] = useState(4);
  const [qualifiers, setQualifiers] = useState(2);
  const [playAllPlaces, setPlayAllPlaces] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [tournamentEnvironment, setTournamentEnvironment] = useState("online");

  const [screen, setScreen] = useState("home");
  const [joinCode, setJoinCode] = useState("");
  const [tournamentId, setTournamentId] = useState(null);
  const [tournamentCode, setTournamentCode] = useState("");
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [playerDocs, setPlayerDocs] = useState([]);
  const [boards, setBoards] = useState([]);
  const [allBoards, setAllBoards] = useState([]);
  const [freeBoards, setFreeBoards] = useState([]);

  const [loadingBoards, setLoadingBoards] = useState(false);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [joiningTournament, setJoiningTournament] = useState(false);
  const [recentTournaments, setRecentTournaments] = useState([]);
  const [loadingRecentTournaments, setLoadingRecentTournaments] = useState(true);
  const [isRestoringTournament, setIsRestoringTournament] = useState(true);

  const [showBoardDialog, setShowBoardDialog] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [roundSettingsMap, setRoundSettingsMap] = useState({});
  const [showRoundSettingsDialog, setShowRoundSettingsDialog] = useState(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(null);
  const [roundSettingsDraft, setRoundSettingsDraft] = useState(DEFAULT_MATCH_SETTINGS);
  const [showEditResultDialog, setShowEditResultDialog] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editingWinnerSlot, setEditingWinnerSlot] = useState("player1");
  const [editingScore1, setEditingScore1] = useState("");
  const [editingScore2, setEditingScore2] = useState("");

  const currentSettings = useMemo(
    () => ({
      tournamentType,
      baseScore,
      inMode,
      outMode,
      maxRounds,
      bullMode,
      bullOffMode,
      scoringMode,
      cricketGameMode,
      matchMode,
      legs,
      sets,
      legsOfSet,
    }),
    [
      tournamentType,
      baseScore,
      inMode,
      outMode,
      maxRounds,
      bullMode,
      bullOffMode,
      scoringMode,
      cricketGameMode,
      matchMode,
      legs,
      sets,
      legsOfSet,
    ],
  );

  const tournamentFormatSettings = useMemo(
    () => ({
      groupSize,
      qualifiers,
      playAllPlaces,
    }),
    [groupSize, qualifiers, playAllPlaces],
  );

  const tournamentSettingsPayload = useMemo(
    () =>
      buildTournamentSettingsPayload(
        currentSettings,
        tournamentFormatSettings,
        pruneRoundSettings(roundSettingsMap, currentSettings),
      ),
    [currentSettings, tournamentFormatSettings, roundSettingsMap],
  );

  const editingScoreLabel = useMemo(
    () => getManualEditScoreLabel(editingMatch, currentSettings, roundSettingsMap),
    [editingMatch, currentSettings, roundSettingsMap],
  );

  const editingTargetWins = useMemo(
    () => getManualEditTargetWins(editingMatch, currentSettings, roundSettingsMap),
    [editingMatch, currentSettings, roundSettingsMap],
  );

  const applyTournamentState = useCallback((tournament, nextScreen = "tournament") => {
    if (!tournament) return;

    rememberRecentTournament(tournament.id);
    setRecentTournaments((prev) => {
      const withoutCurrent = (Array.isArray(prev) ? prev : []).filter(
        (entry) => entry?.id !== tournament.id,
      );
      return [{ ...tournament, id: tournament.id }, ...withoutCurrent].slice(0, MAX_RECENT_TOURNAMENTS);
    });

    setTournamentId(tournament.id);
    setTournamentCode(tournament.code || "");
    setTournamentName(tournament.name || "Turnier");
    setMode(tournament.type === "GROUP_KO" ? "GROUP_KO" : "KO");

    const normalizedSettings = normalizeTournamentSettings(tournament?.settings || {});
    const globalSettings = normalizedSettings.global;
    const formatSettings = normalizedSettings.format;

    setTournamentType(globalSettings.tournamentType || DEFAULT_TOURNAMENT_TYPE);
    setBaseScore(globalSettings.baseScore);
    setInMode(globalSettings.inMode);
    setOutMode(globalSettings.outMode);
    setMaxRounds(globalSettings.maxRounds);
    setBullMode(globalSettings.bullMode);
    setBullOffMode(globalSettings.bullOffMode);
    setScoringMode(globalSettings.scoringMode || DEFAULT_MATCH_SETTINGS.scoringMode);
    setCricketGameMode(globalSettings.cricketGameMode || DEFAULT_CRICKET_SETTINGS.cricketGameMode);
    setMatchMode(globalSettings.matchMode);
    setLegs(globalSettings.legs);
    setSets(globalSettings.sets);
    setLegsOfSet(globalSettings.legsOfSet);
    setGroupSize(formatSettings.groupSize);
    setQualifiers(formatSettings.qualifiers);
    setPlayAllPlaces(formatSettings.playAllPlaces);
    setRoundSettingsMap(normalizedSettings.roundSettings);

    setScreen(nextScreen);
  }, []);

  const handleLeaveTournament = useCallback(() => {
    const shouldLeave = window.confirm("Turnier wirklich verlassen?");
    if (!shouldLeave) return;

    try {
      localStorage.removeItem(LAST_TOURNAMENT_STORAGE_KEY);
    } catch (e) {
      console.warn("LocalStorage cleanup failed", e);
    }

    setTournamentId(null);
    setTournamentCode("");
    setMatches([]);
    setGroups([]);
    setPlayerDocs([]);
    setBoards([]);
    setFreeBoards([]);
    setPlayers(DEFAULT_PLAYERS);
    setScreen("home");
  }, []);

  const handleSaveTournamentSettings = useCallback(async () => {
    if (!tournamentId) return;
    const loadingToastId = toast.loading("Speichere Turniereinstellungen...");

    try {

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: tournamentSettingsPayload,
      });

      toast.success("Turniereinstellungen gespeichert", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Turniereinstellungen konnten nicht gespeichert werden", { id: loadingToastId });
    }
  }, [mode, tournamentId, tournamentName, tournamentSettingsPayload]);

  const openRoundSettingsDialog = useCallback(
    (roundNumber) => {
      const roundKey = String(roundNumber);
      setSelectedRoundNumber(Number(roundNumber));
      setRoundSettingsDraft(extractMatchSettings(roundSettingsMap?.[roundKey] || currentSettings));
      setShowRoundSettingsDialog(true);
    },
    [currentSettings, roundSettingsMap],
  );

  const handleSaveRoundSettings = useCallback(async () => {
    if (!tournamentId || selectedRoundNumber == null) return;
    const loadingToastId = toast.loading(`Speichere Rundeneinstellungen für Runde ${selectedRoundNumber}...`);

    try {

      const nextRoundSettings = pruneRoundSettings(
        {
          ...roundSettingsMap,
          [String(selectedRoundNumber)]: extractMatchSettings(roundSettingsDraft),
        },
        currentSettings,
      );

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: buildTournamentSettingsPayload(
          currentSettings,
          tournamentFormatSettings,
          nextRoundSettings,
        ),
      });

      setRoundSettingsMap(nextRoundSettings);
      setShowRoundSettingsDialog(false);
      setSelectedRoundNumber(null);
      toast.success(`Rundeneinstellungen für Runde ${selectedRoundNumber} gespeichert`, { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Rundeneinstellungen konnten nicht gespeichert werden", { id: loadingToastId });
    }
  }, [
    tournamentId,
    selectedRoundNumber,
    roundSettingsMap,
    roundSettingsDraft,
    tournamentName,
    mode,
    currentSettings,
    tournamentFormatSettings,
  ]);

  const handleResetRoundSettings = useCallback(async () => {
    if (!tournamentId || selectedRoundNumber == null) return;
    const loadingToastId = toast.loading(`Lösche Rundeneinstellungen für Runde ${selectedRoundNumber}...`);

    try {

      const nextRoundSettings = { ...roundSettingsMap };
      delete nextRoundSettings[String(selectedRoundNumber)];

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: buildTournamentSettingsPayload(
          currentSettings,
          tournamentFormatSettings,
          nextRoundSettings,
        ),
      });

      setRoundSettingsMap(nextRoundSettings);
      setRoundSettingsDraft(extractMatchSettings(currentSettings));
      setShowRoundSettingsDialog(false);
      setSelectedRoundNumber(null);
      toast.success(
        `Rundeneinstellungen für Runde ${selectedRoundNumber} gelöscht\nEs gelten wieder die globalen Werte`,
        { id: loadingToastId },
      );
    } catch (error) {
      console.error(error);
      toast.error("Rundeneinstellungen konnten nicht gelöscht werden", { id: loadingToastId });
    }
  }, [
    tournamentId,
    selectedRoundNumber,
    roundSettingsMap,
    tournamentName,
    mode,
    currentSettings,
    tournamentFormatSettings,
  ]);

  const loadBoards = useCallback(async () => {
    const loadingToastId = toast.loading("Lade Boards...");

    try {
      setLoadingBoards(true);
      const loadedBoards = await autodartsApi.getBoards();
      setAllBoards(Array.isArray(loadedBoards) ? loadedBoards : []);
      toast.success("Boards geladen", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Boards konnten nicht geladen werden\nBitte in Autodarts eingeloggt sein", { id: loadingToastId });
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  useEffect(() => {
    const restoreLastTournament = async () => {
      try {
        const savedTournamentId = localStorage.getItem(LAST_TOURNAMENT_STORAGE_KEY);

        if (!savedTournamentId) return;

        const tournament = await db.getTournamentById(savedTournamentId);

        if (!tournament) {
          localStorage.removeItem(LAST_TOURNAMENT_STORAGE_KEY);
          removeRecentTournament(savedTournamentId);
          return;
        }

        applyTournamentState(tournament, "tournament");
      } catch (error) {
        console.error("Letztes Turnier konnte nicht wiederhergestellt werden.", error);
      } finally {
        setIsRestoringTournament(false);
      }
    };

    restoreLastTournament();
  }, [applyTournamentState]);

  useEffect(() => {
    const loadRecentTournaments = async () => {
      try {
        setLoadingRecentTournaments(true);
        const storedIds = readRecentTournamentIds();

        if (!storedIds.length) {
          setRecentTournaments([]);
          return;
        }

        const resolved = await Promise.all(
          storedIds.map(async (id) => ({
            id,
            tournament: await db.getTournamentById(id),
          })),
        );

        const existingTournaments = resolved
          .filter((entry) => !!entry.tournament)
          .map((entry) => entry.tournament);

        const existingIds = existingTournaments.map((entry) => String(entry.id || "").trim()).filter(Boolean);
        writeRecentTournamentIds(existingIds);
        setRecentTournaments(existingTournaments);
      } catch (error) {
        console.error("Letzte Turniere konnten nicht geladen werden.", error);
        setRecentTournaments([]);
      } finally {
        setLoadingRecentTournaments(false);
      }
    };

    loadRecentTournaments();
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!tournamentId) return;

    const unsubMatches = db.subscribeToMatches(tournamentId, (items) => {
      setMatches(sortMatchesByMatchNumber(items));
    });

    const unsubBoards = db.subscribeToBoards(tournamentId, (items) => {
      setBoards(items);
    });

    const unsubFreeBoards = db.subscribeToFreeBoards(tournamentId, (items) => {
      setFreeBoards(items);
    });

    const unsubPlayers = db.subscribeToPlayers(tournamentId, (items) => {
      setPlayerDocs(items);
    });

    db.getGroupsByTournamentId(tournamentId).then(setGroups).catch(console.error);

    return () => {
      unsubMatches?.();
      unsubBoards?.();
      unsubFreeBoards?.();
      unsubPlayers?.();
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!allBoards.length) return;

    // Nur beim ersten Laden setzen
    setBoards((prev) => {
      if (prev.length > 0) return prev;

      return allBoards.map((board) => ({
        id: board.id,
        boardId: board.id,
        name: board.name,
      }));
    });
  }, [allBoards]);

  const getBoardDocForMatch = useCallback(
    (match) => {
      if (!match) return null;
      return (
        boards.find(
          (board) =>
            board.currentMatchId === match.id ||
            (match.boardId && String(board.boardId) === String(match.boardId)),
        ) || null
      );
    },
    [boards],
  );

  const addPlayer = () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;

    // ❌ Prüfen ob Name mit Zahl beginnt
    if (/^\d/.test(trimmed)) {
      toast.error("Der Spielername darf nicht mit einer Zahl beginnen");
      return;
    }

    // ❌ Prüfen auf Duplikate
    if (players.some((p) => String(p).trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Dieser Spieler ist bereits vorhanden");
      return;
    }

    setPlayers((prev) => [...prev, trimmed]);
    setPlayerName("");
  };

  const removePlayer = (name) => {
    setPlayers((prev) => prev.filter((p) => p !== name));
  };

  const createTournament = async () => {
    let loadingToastId = null;

    try {
      if (players.length < 2) {
        toast.error("Bitte mindestens 2 Spieler hinzufügen", { id: loadingToastId || undefined });
        return;
      }

      setCreatingTournament(true);
      loadingToastId = toast.loading("Erstelle Turnier...");

      const type = mode === "KO" ? "KO" : "GROUP_KO";

      const selectedBoards = allBoards.filter((board) =>
        boards.some((selected) => selected.id === board.id || selected.boardId === board.id),
      );

      if (selectedBoards.length <= 0) {
        toast.error("Bitte mindestens 1 Board hinzufügen", { id: loadingToastId || undefined });
        return;
      }

      const result = await logic.createFullTournament(
        tournamentName.trim() || "Mein Turnier",
        type,
        players,
        selectedBoards,
        groupSize,
        qualifiers,
        tournamentSettingsPayload,
      );

      await db.updateTournamentSetup(result.id, {
        name: tournamentName.trim() || "Mein Turnier",
        type,
        settings: tournamentSettingsPayload,
      });

      toast.success("Turnier erstellt", { id: loadingToastId });
      openTournament({
        id: result.id,
        code: result.code,
        name: tournamentName.trim() || "Mein Turnier",
        type,
        settings: tournamentSettingsPayload,
      });
    } catch (error) {
      console.error(error);
      toast.error("Turnier konnte nicht erstellt werden", { id: loadingToastId || undefined });
    } finally {
      setCreatingTournament(false);
    }
  };

  const openTournament = useCallback((tournament) => {
    if (!tournament?.id) return;

    localStorage.setItem(LAST_TOURNAMENT_STORAGE_KEY, tournament.id);
    applyTournamentState(tournament, "tournament");
  }, [applyTournamentState]);

  const joinTournament = async (codeOverride = "") => {
    let loadingToastId = null;

    try {
      const codeToJoin = String(codeOverride || joinCode || "").trim();
      if (!codeToJoin) return;
      setJoiningTournament(true);
      loadingToastId = toast.loading("Lade Turnier...");

      const tournament = await db.getTournamentByCode(codeToJoin);
      if (!tournament) {
        toast.error("Kein Turnier mit diesem Code gefunden", { id: loadingToastId || undefined });
        return;
      }

      toast.success("Turnier geladen", { id: loadingToastId });
      openTournament(tournament);
      setJoinCode("");
    } catch (error) {
      console.error(error);
      toast.error("Turnier konnte nicht geladen werden", { id: loadingToastId || undefined });
    } finally {
      setJoiningTournament(false);
    }
  };

  const handleStartMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;
        if (!freeBoards.length) {
          toast.error("Kein freies Board verfügbar");
          return;
        }

        setSelectedMatch(match);
        setSelectedBoardId(freeBoards[0]?.id || "");
        setShowBoardDialog(true);
      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht vorbereitet werden");
      }
    },
    [freeBoards, tournamentId],
  );

  const confirmStartMatch = useCallback(async () => {
    let matchWindow = null;
    let reservedBoardDoc = null;
    let loadingToastId = null;

    try {
      if (!selectedMatch || !tournamentId || !selectedBoardId) return;

      const boardDoc = freeBoards.find((board) => board.id === selectedBoardId);
      if (!boardDoc) {
        if (matchWindow) matchWindow.close();
        toast.error("Bitte ein freies Board auswählen");
        return;
      }

      loadingToastId = toast.loading("Starte Spiel...");

      const effectiveSettings = getEffectiveMatchSettings(
        selectedMatch,
        currentSettings,
        roundSettingsMap,
      );

      const lobby = await autodartsApi.createLobby({
        tournamentType: effectiveSettings.tournamentType,
        baseScore: effectiveSettings.baseScore,
        inMode: effectiveSettings.inMode,
        outMode: effectiveSettings.outMode,
        bullMode: effectiveSettings.bullMode,
        bullOffMode: effectiveSettings.bullOffMode,
        scoringMode: effectiveSettings.scoringMode,
        cricketGameMode: effectiveSettings.cricketGameMode,
        maxRounds: effectiveSettings.maxRounds,
        legs:
          effectiveSettings.matchMode === "Legs"
            ? effectiveSettings.legs
            : effectiveSettings.legsOfSet,
        sets: effectiveSettings.matchMode === "Sets" ? effectiveSettings.sets : null,
      });

      const player1Name = selectedMatch.player1?.name;
      const player2Name = selectedMatch.player2?.name;

      await autodartsApi.addPlayerToLobby(lobby.id, {
        name: player1Name,
        boardId: boardDoc.boardId,
      });

      await autodartsApi.addPlayerToLobby(lobby.id, {
        name: player2Name,
        boardId: boardDoc.boardId,
      });

      await autodartsApi.startLobby(lobby.id);

      await db.assignBoard(tournamentId, boardDoc, selectedMatch.id);
      reservedBoardDoc = boardDoc;

      await db.setMatchStarted(tournamentId, selectedMatch.id, {
        boardId: boardDoc.boardId,
        lobbyId: lobby.id,
      });

      const matchUrl = `https://play.autodarts.io/matches/${lobby.id}`;
      window.open(matchUrl, "_blank", "noopener,noreferrer");

      watchMatchUntilFinished({
        tournamentId,
        match: {
          ...selectedMatch,
          boardId: boardDoc.boardId,
        },
        boardDocId: boardDoc.id,
        lobbyId: lobby.id,
      });

      setShowBoardDialog(false);
      setSelectedBoardId("");
      setSelectedMatch(null);
      toast.success("Spiel gestartet", { id: loadingToastId });
    } catch (error) {
      if (reservedBoardDoc?.id && tournamentId) {
        try {
          await db.releaseBoard(tournamentId, reservedBoardDoc.id);
        } catch (releaseError) {
          console.warn("Board konnte nach Startfehler nicht zurückgesetzt werden", releaseError);
        }
      }

      if (matchWindow) {
        try {
          matchWindow.close();
        } catch (_) {}
      }

      if (loadingToastId) toast.dismiss(loadingToastId);
      handleAutodartsApiError(error, "Spiel konnte nicht gestartet werden");
    }
  }, [selectedMatch, tournamentId, selectedBoardId, freeBoards, currentSettings, roundSettingsMap]);

  const handleGiveUpMatch = useCallback(
    async (match, forfeitingSlot) => {
      try {
        if (!tournamentId || !match?.id) return;

        const winner = forfeitingSlot === "player1" ? match.player2 : match.player1;
        const loser = forfeitingSlot === "player1" ? match.player1 : match.player2;

        if (!winner || winner.type !== "player") return;

        const shouldGiveUp = window.confirm(
          `${getDisplayName(loser)} wirklich aufgeben lassen? ${getDisplayName(winner)} gewinnt das Spiel.`,
        );
        if (!shouldGiveUp) return;

        await db.setMatchFinished(tournamentId, match.id, winner, loser, {
          resultSource: "manual-forfeit",
        });
      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht per Aufgabe beendet werden");
      }
    },
    [tournamentId],
  );

  const handleAbortLiveMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;

        const reallyAbort = window.confirm(`Live-Spiel ${match.matchNumber} wirklich abbrechen?`);
        if (!reallyAbort) return;

        const boardDoc = getBoardDocForMatch(match);
        const boardId = boardDoc?.id || null;

        let stats = null;
        if (match?.lobbyId) {
          try {
            stats = await autodartsApi.getMatchStats(match.lobbyId);
          } catch (error) {
            if (match?.lobbyId) {
              try {
                stats = await autodartsApi.getMatchStats(match.lobbyId);
              } catch (error) {
                if (error?.code === "TOKEN_REFRESH_REQUIRED") {
                  throw error;
                }

                console.warn("Stats beim Abbrechen konnten nicht geladen werden", error);
              }
            }
          }
        } else {
          console.log("keine lobby id");
        }

        console.log(stats);

        const watcherKey = `${tournamentId}:${match.id}`;
        cancelledMatchWatchers.add(watcherKey);
        activeMatchWatchers.delete(watcherKey);

        if (boardId) {
          await db.releaseBoard(tournamentId, boardId);
        }

        await db.setMatchAborted(tournamentId, match.id, {
          boardId: null,
          lobbyId: null,
          scorePlayer1: stats?.scores?.[0] ?? null,
          scorePlayer2: stats?.scores?.[1] ?? null,
          finalPlayerStats: stats ? extractFinalPlayerStatsFromAutodartsStats(stats) : null,
        });
      } catch (error) {
        handleAutodartsApiError(error, "Live-Spiel konnte nicht abgebrochen werden.");
      }
    },
    [getBoardDocForMatch, tournamentId],
  );

  const handleRestartMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;

        const shouldRestart = window.confirm(
          `Spiel ${match.matchNumber} wirklich neu starten? Der Spielverlauf und alle Folgeeinträge werden zurückgesetzt.`,
        );
        if (!shouldRestart) return;

        const boardDoc = getBoardDocForMatch(match);

        if (boardDoc?.id) {
          await db.releaseBoard(tournamentId, boardDoc.id);
        }

        await db.resetMatchToPending(tournamentId, match.id);

        const watcherKey = `${tournamentId}:${match.id}`;
        cancelledMatchWatchers.add(watcherKey);
        activeMatchWatchers.delete(watcherKey);

        setSelectedMatch({
          ...match,
          status: "pending",
          boardId: null,
          lobbyId: null,
          finalPlayerStats: null,
          startedAt: null,
          finishedAt: null,
          winner: null,
          loser: null,
          scorePlayer1: null,
          scorePlayer2: null,
        });
        setSelectedBoardId(freeBoards[0]?.id || "");
        setShowBoardDialog(true);
      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht neu gestartet werden");
      }
    },
    [freeBoards, getBoardDocForMatch, tournamentId],
  );

  const handleOpenEditResult = useCallback((match) => {
    if (!match) return;

    setEditingMatch(match);
    setEditingWinnerSlot(match?.winner?.name === match?.player2?.name ? "player2" : "player1");
    setEditingScore1(
      match?.scorePlayer1 !== null && match?.scorePlayer1 !== undefined
        ? String(match.scorePlayer1?.legs ?? match.scorePlayer1)
        : "",
    );
    setEditingScore2(
      match?.scorePlayer2 !== null && match?.scorePlayer2 !== undefined
        ? String(match.scorePlayer2?.legs ?? match.scorePlayer2)
        : "",
    );
    setShowEditResultDialog(true);
  }, []);

  const handleSaveEditedResult = useCallback(async () => {
    let loadingToastId = null;

    try {
      if (!tournamentId || !editingMatch) return;

      if (editingScore1 === "" || editingScore2 === "") {
        toast.error("Bitte beide Ergebnisse eingeben");
        return;
      }

      const validation = validateManualMatchResult(
        editingMatch,
        editingWinnerSlot,
        editingScore1,
        editingScore2,
        currentSettings,
        roundSettingsMap,
      );

      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      loadingToastId = toast.loading("Speichere Ergebnis...");

      const winner = editingWinnerSlot === "player1" ? editingMatch.player1 : editingMatch.player2;
      const loser = editingWinnerSlot === "player1" ? editingMatch.player2 : editingMatch.player1;

      await db.correctMatchResult(tournamentId, editingMatch.id, {
        winner,
        loser,
        scorePlayer1: validation.score1,
        scorePlayer2: validation.score2,
      });

      setShowEditResultDialog(false);
      setEditingMatch(null);
      setEditingWinnerSlot("player1");
      setEditingScore1("");
      setEditingScore2("");
      toast.success("Ergebnis gespeichert", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Ergebnis konnte nicht gespeichert werden", { id: loadingToastId || undefined });
    }
  }, [
    tournamentId,
    editingMatch,
    editingWinnerSlot,
    editingScore1,
    editingScore2,
    currentSettings,
    roundSettingsMap,
  ]);

  const handleReleaseBoard = useCallback(
    async (board, currentMatch) => {
      try {
        if (!tournamentId || !board?.id) return;

        const reallyRelease = window.confirm(
          `Board ${board.name || board.boardId || board.id} wirklich freigeben?`,
        );
        if (!reallyRelease) return;

        await db.releaseBoard(tournamentId, board.id);

        if (currentMatch?.id && isLiveMatch(currentMatch)) {
          await db.setMatchAborted(tournamentId, currentMatch.id, {
            boardId: null,
            lobbyId: null,
          });
        }
      } catch (error) {
        console.error(error);
        toast.error("Board konnte nicht freigegeben werden");
      }
    },
    [tournamentId],
  );

  const selectedBoardName = useMemo(() => {
    const board = freeBoards.find((item) => item.id === selectedBoardId);
    return board?.name || board?.boardId || "";
  }, [freeBoards, selectedBoardId]);

  const tournamentFinished = useMemo(() => isTournamentFinished(matches), [matches]);

  const renderHome = () => {
    if (screen === "create") {
      return (
        <div className="tournament-layout">
          <div className="players-panel">
            <div className="panel-header">
              <div>
                <h2>Spieler</h2>
                <div className="panel-subtitle">Spielerliste für das neue Turnier</div>
              </div>
              <div className="players-count-badge">{players.length}</div>
            </div>

            <div className="player-add-row">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Spielername eingeben"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addPlayer();
                }}
              />
              <button className="btn btn--primary" onClick={addPlayer}>
                Hinzufügen
              </button>
            </div>

            <div className="players-list">
              {players.map((player) => (
                <div className="player-item" key={player}>
                  <span>{player}</span>
                  <button className="btn btn--icon remove-btn" onClick={() => removePlayer(player)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="tournament-container">
            <div className="form-topbar">
              <button className="btn btn--secondary" onClick={() => setScreen("home")}>
                Zurück
              </button>
            </div>

            <div className="form-hero">
              <h2>{tournamentName}</h2>
              <div className="panel-subtitle">
                Erstelle ein KO- oder Gruppen-Turnier für Autodarts.
              </div>
            </div>

            <div className="config-sections">
              <div className="config-card">
                <div className="config-card-title">Allgemein</div>
                <div className="grid3">
                  <div className="field">
                    <label>Turniermodus</label>
                    <select value={mode} onChange={(e) => setMode(e.target.value)}>
                      <option value="KO">KO</option>
                      <option value="GROUP_KO">Gruppen + KO</option>
                    </select>
                  </div>

                   <div className="field">
                    <label>Platzierungsspiele</label>
                    <select
                      value={playAllPlaces ? "all" : "top_only"}
                      onChange={(e) => setPlayAllPlaces(e.target.value === "all")}
                    >
                      <option value="top_only">Nur Siegerbaum</option>
                      <option value="all">Alle KO-Plätze ausspielen</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Turniertyp</label>
                    <select
                      value={tournamentType}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setTournamentType(nextType);
                        if (nextType === "Cricket") {
                          setBullOffMode(DEFAULT_CRICKET_SETTINGS.bullOffMode);
                          setMaxRounds(DEFAULT_CRICKET_SETTINGS.maxRounds);
                          setLegs(DEFAULT_CRICKET_SETTINGS.legs);
                          setScoringMode(DEFAULT_CRICKET_SETTINGS.scoringMode);
                          setCricketGameMode(DEFAULT_CRICKET_SETTINGS.cricketGameMode);
                        } else {
                          setBullOffMode(DEFAULT_MATCH_SETTINGS.bullOffMode);
                        }
                      }}
                    >
                      {TOURNAMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {getTournamentTypeLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="config-card">
                <div className="config-card-title">Spiel-Einstellungen</div>
                <div className="grid">
                  {tournamentType === "Cricket" ? (
                    <>
                      <div className="field">
                        <label>Game Mode</label>
                        <select value={cricketGameMode} onChange={(e) => setCricketGameMode(e.target.value)}>
                          {CRICKET_GAME_MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Scoring</label>
                        <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value)}>
                          {CRICKET_SCORING_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Startscore</label>
                        <select value={baseScore} onChange={(e) => setBaseScore(Number(e.target.value))}>
                          {SCORE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>In</label>
                        <select value={inMode} onChange={(e) => setInMode(e.target.value)}>
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Out</label>
                        <select value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Modus</label>
                        <select value={bullMode} onChange={(e) => setBullMode(e.target.value)}>
                          {BULL_MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label>Match-Modus</label>
                    <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)}>
                      {MATCH_MODE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {matchMode === "Legs" ? (
                    <div className="field">
                      <label>First to Legs</label>
                      <select value={legs} onChange={(e) => setLegs(Number(e.target.value))}>
                        {LEGS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label>First to Sets</label>
                        <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
                          {SETS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Legs pro Set</label>
                        <select value={legsOfSet} onChange={(e) => setLegsOfSet(Number(e.target.value))}>
                          {LEGS_OF_SET_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {mode === "GROUP_KO" && (
                <div className="config-card">
                  <div className="config-card-title">Gruppenphase</div>
                  <div className="config-card-hint">
                    Hinweis: In Gruppen + KO gelten die globalen Spieleinstellungen für die
                    Gruppenphase. Eigene Rundeneinstellungen kannst du später für die KO-Runden
                    setzen.
                  </div>
                  <div className="grid">
                    <div className="field">
                      <label>Spieler pro Gruppe</label>
                      <select
                        value={groupSize}
                        onChange={(e) => setGroupSize(Number(e.target.value))}
                      >
                        {GROUP_SIZE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label>Qualifikanten pro Gruppe</label>
                      <select
                        value={qualifiers}
                        onChange={(e) => setQualifiers(Number(e.target.value))}
                      >
                        {QUALIFIER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="config-card">
                <div className="config-card-title">Verfügbare Autodarts-Boards</div>
                {loadingBoards ? (
                  <div className="panel-subtitle">Boards werden geladen…</div>
                ) : (
                  <div className="players-list">
                    {allBoards.map((board) => {
                      const isSelected = boards.some(
                        (selected) => selected.id === board.id || selected.boardId === board.id,
                      );

                      return (
                        <label key={board.id} className="player-item board-select-item">
                          <span>{board.name || board.id}</span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setBoards((prev) => {
                                if (e.target.checked) {
                                  return [
                                    ...prev,
                                    { id: board.id, boardId: board.id, name: board.name },
                                  ];
                                }
                                return prev.filter(
                                  (item) => item.id !== board.id && item.boardId !== board.id,
                                );
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="actions">
                <button className="btn btn--secondary" onClick={() => setScreen("home")}>
                  Zurück
                </button>
                <button
                  className="btn btn--primary"
                  onClick={createTournament}
                  disabled={creatingTournament}
                >
                  {creatingTournament ? "Erstelle..." : "Turnier erstellen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="start-screen">
        <div className="start-card">
          <div className="start-card-head">
            <div>
              <h2>Dart Cup</h2>
              <div className="start-subtitle">
                Turniere erstellen oder bestehendem Turnier beitreten.
              </div>
            </div>
          </div>

          <div className="config-sections">
            <div className="config-card join-card">
              <div className="config-card-title">Turnier erstellen</div>
              <div className="join-row">
                <input
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Turniername eingeben"
                />
                <button className="btn btn--primary" onClick={() => setScreen("create")}>
                  {creatingTournament ? "erstelle..." : "Erstellen"}
                </button>
              </div>
            </div>

            <div className="config-sections">
              <div className="config-card join-card">
                <div className="config-card-title">Turnier öffnen</div>
                <div className="join-row">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Turniercode eingeben"
                  />
                  <button
                    className="btn btn--primary"
                    onClick={() => joinTournament()}
                    disabled={joiningTournament}
                  >
                    {joiningTournament ? "Lade..." : "Beitreten"}
                  </button>
                </div>
              </div>

              <div className="config-card join-card">
                <div className="config-card-title">Zuletzt geöffnete Turniere</div>

                {loadingRecentTournaments ? (
                  <div className="recent-tournaments-empty">Letzte Turniere werden geladen...</div>
                ) : recentTournaments.length ? (
                  <div className="recent-tournaments-list">
                    {recentTournaments.map((recentTournament) => (
                      <div key={recentTournament.id} className="recent-tournament-item">
                        <div className="recent-tournament-main">
                          <div className="recent-tournament-name">
                            {recentTournament.name || "Unbenanntes Turnier"}
                          </div>
                          <div className="recent-tournament-meta">
                            {recentTournament.code
                              ? `Code: ${recentTournament.code}`
                              : `ID: ${recentTournament.id}`}
                          </div>
                        </div>
                        <button
                          className="btn btn--primary"
                          onClick={() => openTournament(recentTournament)}
                          disabled={joiningTournament}
                        >
                          Beitreten
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="recent-tournaments-empty">
                    Noch keine zuletzt geöffneten Turniere gespeichert.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTournament = () => (
    <div className="tournament-bracket-only">
      <div className="bracket-page-shell">
        <div className="bracket-hero">
          <div className="bracket-header">
            <div>
              <h2>
                {tournamentName}
                {tournamentCode && <span className="code-badge">Code: {tournamentCode}</span>}
              </h2>
              <div className="bracket-subtitle">
                {`${getTournamentTypeLabel(tournamentType)} · ${mode === "KO" ? "KO-Turnier" : "Gruppenphase mit KO-Finalrunde"}`}
              </div>
            </div>

            <div className="bracket-header-actions">
              <button className="btn btn--secondary" onClick={() => setShowSettingsDialog(true)}>
                Einstellungen
              </button>
              <button className="btn btn--secondary" onClick={handleLeaveTournament}>
                Turnier verlassen
              </button>
            </div>
          </div>

          <OverviewStats
            matches={matches}
            boards={boards}
            playersCount={playerDocs.length}
            mode={mode}
          />
        </div>

        <BoardOverview boards={boards} matches={matches} onReleaseBoard={handleReleaseBoard} />

        <TournamentTree
          matches={matches}
          groups={groups}
          mode={mode}
          matchMode={matchMode}
          qualifiedPerGroup={qualifiers}
          onStartMatch={handleStartMatch}
          onGiveUpMatch={handleGiveUpMatch}
          onEditResult={handleOpenEditResult}
          onRestartMatch={handleRestartMatch}
          onAbortLiveMatch={handleAbortLiveMatch}
          tournamentId={tournamentId}
          roundSettings={roundSettingsMap}
          onOpenRoundSettings={openRoundSettingsDialog}
          onOpenGlobalSettings={() => setShowSettingsDialog(true)}
          tournamentType={tournamentType}
        />

        <FinalStandingsTable
          matches={matches}
          players={playerDocs}
          tournamentName={tournamentName}
          tournamentType={tournamentType}
          matchMode={matchMode}
        />
      </div>
    </div>
  );

  if (isRestoringTournament) {
    return (
      <div className="tournament-layout">
        <div className="tournament-container">
          <div className="output">Letztes Turnier wird geladen...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === "tournament" ? renderTournament() : renderHome()}

      {showSettingsDialog && (
        <div className="board-dialog-overlay">
          <div className="board-dialog board-dialog--wide">
            <h3>Turniereinstellungen bearbeiten</h3>
            <div className="board-dialog-subtitle">
              Gespeicherte Einstellungen ändern und für neue Spiele übernehmen.
            </div>
            {mode === "GROUP_KO" && (
              <div className="phase-settings-note phase-settings-note--dialog">
                Diese globalen Spieleinstellungen gelten auch für die Gruppenphase.
                Rundeneinstellungen überschreiben sie nur in der KO-Finalrunde.
              </div>
            )}

            <div className="config-sections settings-editor-grid">
              <div className="config-card">
                <div className="config-card-title">Spiel-Einstellungen</div>
                <div className="grid">
                  {tournamentType === "Cricket" ? (
                    <>
                      <div className="field">
                        <label>Scoring</label>
                        <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value)}>
                          {CRICKET_SCORING_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Startscore</label>
                        <select value={baseScore} onChange={(e) => setBaseScore(Number(e.target.value))}>
                          {SCORE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>In</label>
                        <select value={inMode} onChange={(e) => setInMode(e.target.value)}>
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Out</label>
                        <select value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Modus</label>
                        <select value={bullMode} onChange={(e) => setBullMode(e.target.value)}>
                          {BULL_MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label>Match-Modus</label>
                    <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)}>
                      {MATCH_MODE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {matchMode === "Legs" ? (
                    <div className="field">
                      <label>First to Legs</label>
                      <select value={legs} onChange={(e) => setLegs(Number(e.target.value))}>
                        {LEGS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label>First to Sets</label>
                        <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
                          {SETS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Legs pro Set</label>
                        <select value={legsOfSet} onChange={(e) => setLegsOfSet(Number(e.target.value))}>
                          {LEGS_OF_SET_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="board-dialog-actions">
              <button className="btn btn--secondary" onClick={() => setShowSettingsDialog(false)}>
                Schließen
              </button>
              <button
                className="btn btn--primary"
                onClick={async () => {
                  await handleSaveTournamentSettings();
                  setShowSettingsDialog(false);
                }}
              >
                Einstellungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoundSettingsDialog && (
        <div className="board-dialog-overlay">
          <div className="board-dialog board-dialog--wide">
            <h3>Rundeneinstellungen bearbeiten</h3>
            <div className="board-dialog-subtitle">
              Runde {selectedRoundNumber}: Diese Werte überschreiben die globalen Einstellungen nur
              für diese Runde.
            </div>

            <div className="config-sections settings-editor-grid">
              <div className="config-card">
                <div className="config-card-title">
                  Spiel-Einstellungen für Runde {selectedRoundNumber}
                </div>
                <div className="grid">
                  {roundSettingsDraft.tournamentType === "Cricket" ? (
                    <>
                      <div className="field">
                        <label>Game Mode</label>
                        <select
                          value={roundSettingsDraft.cricketGameMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, cricketGameMode: e.target.value }))
                          }
                        >
                          {CRICKET_GAME_MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Scoring</label>
                        <select
                          value={roundSettingsDraft.scoringMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, scoringMode: e.target.value }))
                          }
                        >
                          {CRICKET_SCORING_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select
                          value={roundSettingsDraft.maxRounds}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, maxRounds: Number(e.target.value) }))
                          }
                        >
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select
                          value={roundSettingsDraft.bullOffMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, bullOffMode: e.target.value }))
                          }
                        >
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field">
                        <label>Startscore</label>
                        <select
                          value={roundSettingsDraft.baseScore}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, baseScore: Number(e.target.value) }))
                          }
                        >
                          {SCORE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>In</label>
                        <select
                          value={roundSettingsDraft.inMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, inMode: e.target.value }))
                          }
                        >
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Out</label>
                        <select
                          value={roundSettingsDraft.outMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, outMode: e.target.value }))
                          }
                        >
                          {MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Maximale Runden</label>
                        <select
                          value={roundSettingsDraft.maxRounds}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, maxRounds: Number(e.target.value) }))
                          }
                        >
                          {MAX_ROUNDS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Modus</label>
                        <select
                          value={roundSettingsDraft.bullMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, bullMode: e.target.value }))
                          }
                        >
                          {BULL_MODE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Bull-Off</label>
                        <select
                          value={roundSettingsDraft.bullOffMode}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, bullOffMode: e.target.value }))
                          }
                        >
                          {BULL_OFF_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label>Match-Modus</label>
                    <select
                      value={roundSettingsDraft.matchMode}
                      onChange={(e) =>
                        setRoundSettingsDraft((prev) => ({ ...prev, matchMode: e.target.value }))
                      }
                    >
                      {MATCH_MODE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {roundSettingsDraft.matchMode === "Legs" ? (
                    <div className="field">
                      <label>First to Legs</label>
                      <select
                        value={roundSettingsDraft.legs}
                        onChange={(e) =>
                          setRoundSettingsDraft((prev) => ({ ...prev, legs: Number(e.target.value) }))
                        }
                      >
                        {LEGS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label>First to Sets</label>
                        <select
                          value={roundSettingsDraft.sets}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, sets: Number(e.target.value) }))
                          }
                        >
                          {SETS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Legs pro Set</label>
                        <select
                          value={roundSettingsDraft.legsOfSet}
                          onChange={(e) =>
                            setRoundSettingsDraft((prev) => ({ ...prev, legsOfSet: Number(e.target.value) }))
                          }
                        >
                          {LEGS_OF_SET_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="board-dialog-actions">
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setShowRoundSettingsDialog(false);
                  setSelectedRoundNumber(null);
                }}
              >
                Schließen
              </button>
              <button className="btn btn--danger" onClick={handleResetRoundSettings}>
                Rundeneinstellungen löschen
              </button>
              <button className="btn btn--primary" onClick={handleSaveRoundSettings}>
                Rundeneinstellungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {showBoardDialog && (
        <div className="board-dialog-overlay">
          <div className="board-dialog">
            <h3>Board auswählen</h3>
            <div className="board-dialog-subtitle">
              Wähle ein freies Board für Spiel {selectedMatch?.matchNumber}.
            </div>

            <div className="field">
              <label>Freies Board</label>
              <select value={selectedBoardId} onChange={(e) => setSelectedBoardId(e.target.value)}>
                {freeBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name || board.boardId || board.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="board-dialog-subtitle dialog-subtitle-spaced">
              Ausgewählt: <strong>{selectedBoardName || "—"}</strong>
            </div>

            <div className="board-dialog-actions">
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setShowBoardDialog(false);
                  setSelectedBoardId("");
                  setSelectedMatch(null);
                }}
              >
                Abbrechen
              </button>

              <button className="btn btn--primary" onClick={confirmStartMatch}>
                Spiel starten
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditResultDialog && editingMatch && (
        <div className="board-dialog-overlay">
          <div className="board-dialog">
            <h3>Ergebnis bearbeiten</h3>
            <div className="board-dialog-subtitle">
              Spiel {editingMatch.matchNumber}: {getDisplayName(editingMatch.player1)} gegen{" "}
              {getDisplayName(editingMatch.player2)}
            </div>

            <div className="field">
              <label>Sieger</label>
              <select
                value={editingWinnerSlot}
                onChange={(e) => setEditingWinnerSlot(e.target.value)}
              >
                <option value="player1">{getDisplayName(editingMatch.player1)}</option>
                <option value="player2">{getDisplayName(editingMatch.player2)}</option>
              </select>
            </div>

            <div className="board-dialog-subtitle dialog-subtitle-spaced">
              Erlaubt sind nur gültige Endstände. Sieger: genau {editingTargetWins}{" "}
              {editingScoreLabel}. Verlierer: maximal {Math.max(0, editingTargetWins - 1)}.
            </div>

            <div className="dialog-score-grid dialog-score-grid-spaced">
              <div className="field">
                <label>
                  {editingScoreLabel} {getDisplayName(editingMatch.player1)}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editingScore1}
                  onChange={(e) => setEditingScore1(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="field">
                <label>
                  {editingScoreLabel} {getDisplayName(editingMatch.player2)}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editingScore2}
                  onChange={(e) => setEditingScore2(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="board-dialog-actions">
              <button
                className="btn btn--secondary"
                onClick={() => {
                  setShowEditResultDialog(false);
                  setEditingMatch(null);
                  setEditingWinnerSlot("player1");
                  setEditingScore1("");
                  setEditingScore2("");
                }}
              >
                Schließen
              </button>

              <button className="btn btn--primary" onClick={handleSaveEditedResult}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 2147483647 }}
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
          },
        }}
      />
    </>
  );
}
