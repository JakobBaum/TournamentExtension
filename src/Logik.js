import { TournamentDB } from "./TournamentDB.js";

export class Logik {
  constructor() {
    this.db = new TournamentDB();
  }

  createBye() {
    return {
      type: "bye",
      name: "Freilos",
    };
  }

  createWinnerRef(ref) {
    return {
      type: "match",
      ref: Number(ref),
      source: "winner",
    };
  }

  createLoserRef(ref) {
    return {
      type: "match",
      ref: Number(ref),
      source: "loser",
    };
  }

  createQualifierRef(ref) {
    return {
      type: "qualifier",
      ref,
      qualifierRef: ref,
    };
  }

  nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

  buildPlacementLabel(startPlace, endPlace, isFinal = false) {
    if (startPlace === 1 && endPlace === 2) return "Finale";
    if (startPlace === 3 && endPlace === 4) return "Spiel um Platz 3";
    if (startPlace === endPlace) return `Platz ${startPlace}`;
    if (endPlace - startPlace === 1 && isFinal) return `Spiel um Platz ${startPlace}`;
    return `Plätze ${startPlace}-${endPlace}`;
  }

  buildPlacementTree(slots, startPlace, endPlace, options = {}) {
    const {
      startRound = 1,
      startMatchNumber = 1,
      bracketType = "placement",
      placementGroupLabel = null,
    } = options;

    const participantCount = endPlace - startPlace + 1;

    if (!Array.isArray(slots) || slots.length !== participantCount) {
      throw new Error("Ungültige Platzierungsbaum-Konfiguration");
    }

    if (participantCount < 2 || (participantCount & (participantCount - 1)) !== 0) {
      throw new Error("Platzierungsbaum benötigt eine Zweierpotenz");
    }

    let matchNumber = startMatchNumber;
    const matches = [];

    const buildNode = (nodeSlots, rangeStart, rangeEnd, round) => {
      const size = rangeEnd - rangeStart + 1;

      if (size === 2) {
        const [p1, p2] = nodeSlots;
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType,
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: rangeStart,
          loserPlace: rangeEnd,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd, true),
          placementGroupLabel,
        };

        matches.push(match);
        return match;
      }

      const firstRoundMatches = [];

      for (let i = 0; i < nodeSlots.length; i += 2) {
        const p1 = nodeSlots[i];
        const p2 = nodeSlots[i + 1];
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType,
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: null,
          loserPlace: null,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd),
          placementGroupLabel,
        };

        matches.push(match);
        firstRoundMatches.push(match);
      }

      const halfSize = size / 2;
      const upperSlots = firstRoundMatches.map((match) => this.createWinnerRef(match.matchNumber));
      const lowerSlots = firstRoundMatches.map((match) => this.createLoserRef(match.matchNumber));

      buildNode(upperSlots, rangeStart, rangeStart + halfSize - 1, round + 1);
      buildNode(lowerSlots, rangeStart + halfSize, rangeEnd, round + 1);

      return null;
    };

    buildNode(slots, startPlace, endPlace, startRound);

    return {
      matches,
      nextMatchNumber: matchNumber,
    };
  }

  buildMainBracket(slots, options = {}) {
    const {
      startRound = 1,
      startMatchNumber = 1,
      playAllPlaces = false,
    } = options;

    if (!Array.isArray(slots) || slots.length < 2) {
      throw new Error("Mindestens 2 Slots für KO-Baum nötig");
    }

    const bracketSize = slots.length;
    if ((bracketSize & (bracketSize - 1)) !== 0) {
      throw new Error("KO-Baum benötigt eine Zweierpotenz");
    }

    let matchNumber = startMatchNumber;
    const matches = [];

    const buildNode = (nodeSlots, rangeStart, rangeEnd, round) => {
      const size = rangeEnd - rangeStart + 1;

      if (size === 2) {
        const [p1, p2] = nodeSlots;
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType: "main",
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: rangeStart,
          loserPlace: rangeEnd,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd, true),
          placementGroupLabel: null,
        };

        matches.push(match);
        return match;
      }

      const firstRoundMatches = [];

      for (let i = 0; i < nodeSlots.length; i += 2) {
        const p1 = nodeSlots[i];
        const p2 = nodeSlots[i + 1];
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType: "main",
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: null,
          loserPlace: null,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd),
          placementGroupLabel: null,
        };

        matches.push(match);
        firstRoundMatches.push(match);
      }

      const halfSize = size / 2;
      const winnerSlots = firstRoundMatches.map((match) => this.createWinnerRef(match.matchNumber));
      buildNode(winnerSlots, rangeStart, rangeStart + halfSize - 1, round + 1);

      if (playAllPlaces) {
        const loserSlots = firstRoundMatches.map((match) => this.createLoserRef(match.matchNumber));
        const placementResult = this.buildPlacementTree(
          loserSlots,
          rangeStart + halfSize,
          rangeEnd,
          {
            startRound: round + 1,
            startMatchNumber: matchNumber,
            bracketType: "placement",
            placementGroupLabel: this.buildPlacementLabel(rangeStart + halfSize, rangeEnd),
          },
        );

        matches.push(...placementResult.matches);
        matchNumber = placementResult.nextMatchNumber;
      }

      return null;
    };

    buildNode(slots, 1, bracketSize, startRound);

    return {
      matches,
      nextMatchNumber: matchNumber,
    };
  }
  distributeSlotsAvoidingDoubleByes(entries = []) {
    const realPlayers = this.shuffleArray(entries.filter((entry) => entry?.type !== "bye"));
    const byes = entries.filter((entry) => entry?.type === "bye");

    if (byes.length === 0) return realPlayers;
    if (realPlayers.length === 0) return byes;

    const totalSlots = realPlayers.length + byes.length;
    const result = new Array(totalSlots).fill(null);

    let playerIndex = 0;
    for (let i = 0; i < totalSlots; i += 2) {
      if (playerIndex < realPlayers.length) {
        result[i] = realPlayers[playerIndex++];
      }
    }

    for (let i = 1; i < totalSlots; i += 2) {
      if (playerIndex < realPlayers.length) {
        result[i] = realPlayers[playerIndex++];
      }
    }

    let byeIndex = 0;
    for (let i = 0; i < totalSlots && byeIndex < byes.length; i++) {
      if (result[i]) continue;

      const left = i > 0 ? result[i - 1] : null;
      const right = i < totalSlots - 1 ? result[i + 1] : null;

      const leftIsBye = left?.type === "bye";
      const rightIsBye = right?.type === "bye";

      if (!leftIsBye && !rightIsBye) {
        result[i] = byes[byeIndex++];
      }
    }

    for (let i = 0; i < totalSlots && byeIndex < byes.length; i++) {
      if (!result[i]) {
        result[i] = byes[byeIndex++];
      }
    }

    return result;
  }

  parseQualifierRef(ref = "") {
    const match = String(ref || "").match(/^G([A-Z]+)-(\d+)$/i);
    if (!match) {
      return {
        groupLetter: null,
        rank: Number.MAX_SAFE_INTEGER,
      };
    }

    return {
      groupLetter: String(match[1] || "").toUpperCase(),
      rank: Number(match[2] || 0),
    };
  }

  buildGroupKoSlots(groups = [], qualifiedPerGroup = 2) {
    const qualifiers = [];

    for (let g = 0; g < groups.length; g++) {
      const groupLetter = String.fromCharCode(65 + g);
      const playerCountInGroup = groups[g]?.players?.length || 0;
      const actualQualifiers = Math.min(qualifiedPerGroup, playerCountInGroup);

      for (let q = 1; q <= actualQualifiers; q++) {
        qualifiers.push({
          ...this.parseQualifierRef(`G${groupLetter}-${q}`),
          slot: this.createQualifierRef(`G${groupLetter}-${q}`),
        });
      }
    }

    if (qualifiers.length < 2) {
      return qualifiers.map((entry) => entry.slot);
    }

    qualifiers.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return String(a.groupLetter || "").localeCompare(String(b.groupLetter || ""), "de");
    });

    const bracketSize = this.nextPowerOfTwo(qualifiers.length);
    const byeCount = bracketSize - qualifiers.length;
    const byeSeeds = qualifiers.slice(0, byeCount);
    const remaining = qualifiers.slice(byeCount);
    const playedPairs = [];

    while (remaining.length > 0) {
      const first = remaining.shift();
      if (!first) break;

      if (remaining.length === 0) {
        playedPairs.push([first.slot, this.createBye()]);
        break;
      }

      const findLastMatchingIndex = (predicate) => {
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (predicate(remaining[i])) return i;
        }
        return -1;
      };

      let opponentIndex = findLastMatchingIndex(
        (entry) => entry.groupLetter !== first.groupLetter && entry.rank !== first.rank,
      );

      if (opponentIndex === -1) {
        opponentIndex = findLastMatchingIndex((entry) => entry.groupLetter !== first.groupLetter);
      }

      if (opponentIndex === -1) {
        opponentIndex = findLastMatchingIndex((entry) => entry.rank !== first.rank);
      }

      if (opponentIndex === -1) {
        opponentIndex = remaining.length - 1;
      }

      const opponent = remaining.splice(opponentIndex, 1)[0];
      playedPairs.push([first.slot, opponent.slot]);
    }

    const byePairs = byeSeeds.map((entry) => [entry.slot, this.createBye()]);
    const totalPairs = bracketSize / 2;
    const orderedPairs = [];
    let byePairIndex = 0;
    let playedPairIndex = 0;

    while (orderedPairs.length < totalPairs) {
      if (byePairIndex < byePairs.length) {
        orderedPairs.push(byePairs[byePairIndex++]);
      }

      if (orderedPairs.length >= totalPairs) break;

      if (playedPairIndex < playedPairs.length) {
        orderedPairs.push(playedPairs[playedPairIndex++]);
      } else if (byePairIndex < byePairs.length) {
        orderedPairs.push(byePairs[byePairIndex++]);
      }
    }

    while (orderedPairs.length < totalPairs) {
      orderedPairs.push([this.createBye(), this.createBye()]);
    }

    return orderedPairs.flat();
  }

  generateTournament(players, playersPerGroup = 4, qualifiedPerGroup = 2,withReturnLeg=false, options = {}) {
    if (!Array.isArray(players) || players.length < 2) {
      throw new Error("Mindestens 2 Spieler nötig");
    }

    const shuffled = this.shuffleArray(players);

    const groups = [];
    const matches = [];
    const numGroups = Math.ceil(shuffled.length / playersPerGroup);

    for (let g = 0; g < numGroups; g++) {
      const start = g * playersPerGroup;
      const end = start + playersPerGroup;
      const groupPlayers = shuffled.slice(start, end);

      const groupLetter = String.fromCharCode(65 + g);
      const groupName = `Gruppe ${groupLetter}`;

      groups.push({
        name: groupName,
        players: groupPlayers,
      });

      let groupMatchCounter = 1;

      for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          matches.push({
            matchNumber: `${groupLetter}-${groupMatchCounter}`,
            round: 1,
            group: groupName,
            player1: groupPlayers[i],
            player2: groupPlayers[j],
            winner: null,
            loser: null,
            status: "pending",
            boardId: null,
            bracketType: "group",
            placementRangeStart: null,
            placementRangeEnd: null,
            winnerPlace: null,
            loserPlace: null,
            displayRoundName: groupName,
            placementGroupLabel: null,
          });

          groupMatchCounter++;
        }
      }

      if(withReturnLeg){
        for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          matches.push({
            matchNumber: `${groupLetter}-${groupMatchCounter}`,
            round: 1,
            group: groupName,
            player1: groupPlayers[j],
            player2: groupPlayers[i],
            winner: null,
            loser: null,
            status: "pending",
            boardId: null,
            bracketType: "group",
            placementRangeStart: null,
            placementRangeEnd: null,
            winnerPlace: null,
            loserPlace: null,
            displayRoundName: groupName,
            placementGroupLabel: null,
          });

          groupMatchCounter++;
        }
      }
      }
    }

    const qualifierRefs = this.buildGroupKoSlots(groups, qualifiedPerGroup);

    if (qualifierRefs.length < 2) {
      return {
        type: "group_ko",
        groups,
        matches,
      };
    }

    const koSlots = qualifierRefs;

    const bracket = this.buildMainBracket(koSlots, {
      startRound: 2,
      startMatchNumber: 1,
      playAllPlaces: !!options.playAllPlaces,
    });

    matches.push(...bracket.matches);

    return {
      type: "group_ko",
      groups,
      matches,
    };
  }

  generateKOTournament(players, options = {}) {
    if (!Array.isArray(players) || players.length < 2) {
      throw new Error("Mindestens 2 Spieler nötig");
    }

    const bracketSize = this.nextPowerOfTwo(players.length);
    const byes = bracketSize - players.length;
    const firstRoundPlayers = this.distributeSlotsAvoidingDoubleByes([
  ...players,
  ...Array.from({ length: byes }, () => this.createBye()),
]);

    const bracket = this.buildMainBracket(firstRoundPlayers, {
      startRound: 1,
      startMatchNumber: 1,
      playAllPlaces: !!options.playAllPlaces,
    });

    return {
      type: "ko",
      matches: bracket.matches,
    };
  }

  async createFullTournament(
    tournamentName,
    type,
    players,
    boards,
    playersPerGroup,
    qualifiedPerGroup,
    withReturnLeg=false,
    settings = {},
  ) {
    let code = Math.random().toString(36).substring(2, 8);
    const tournamentId = await this.db.createTournament(tournamentName, code, type, settings);

    let data = {};
    let playersWithIds = [];
    let groups = [];

    if (type == "KO") {
      playersWithIds = await this.db.createPlayers(tournamentId, players, settings);
      await new Promise((r) => setTimeout(r, 0));
      data = this.generateKOTournament(playersWithIds, settings);
    } else {
      const previewData = this.generateTournament(players, playersPerGroup, qualifiedPerGroup,withReturnLeg, settings);
      groups = await this.db.createGroups(tournamentId, previewData.groups);
      playersWithIds = await this.db.createPlayersGroups(tournamentId, groups, settings);
      data = this.generateTournament(playersWithIds, playersPerGroup, qualifiedPerGroup,withReturnLeg, settings);
    }

    await this.db.createMatches(tournamentId, data.matches, playersWithIds);
    await this.db.autoAdvanceExistingWinners(tournamentId);

    if (boards) {
      await this.db.addBoards(tournamentId, boards);
    }

    return {
      id: tournamentId,
      code: code,
      data: data,
      players: playersWithIds,
    };
  }
}
