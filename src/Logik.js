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

  generateTournament(players, playersPerGroup = 4, qualifiedPerGroup = 2, options = {}) {
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
    }

    const qualifierRefs = [];

    for (let g = 0; g < groups.length; g++) {
      const groupLetter = String.fromCharCode(65 + g);
      const playerCountInGroup = groups[g].players.length;
      const actualQualifiers = Math.min(qualifiedPerGroup, playerCountInGroup);

      for (let q = 1; q <= actualQualifiers; q++) {
        qualifierRefs.push(this.createQualifierRef(`G${groupLetter}-${q}`));
      }
    }

    if (qualifierRefs.length < 2) {
      return {
        type: "group_ko",
        groups,
        matches,
      };
    }

    const bracketSize = this.nextPowerOfTwo(qualifierRefs.length);
    const koSlots = this.shuffleArray([
      ...qualifierRefs,
      ...Array.from({ length: bracketSize - qualifierRefs.length }, () => this.createBye()),
    ]);

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
    const firstRoundPlayers = this.shuffleArray([
      ...this.shuffleArray(players),
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
    settings = {},
  ) {
    let code = Math.random().toString(36).substring(2, 8);
    const tournamentId = await this.db.createTournament(tournamentName, code, type, settings);

    let data = {};
    let playersWithIds = [];
    let groups = [];

    if (type == "KO") {
      playersWithIds = await this.db.createPlayers(tournamentId, players);
      await new Promise((r) => setTimeout(r, 0));
      data = this.generateKOTournament(playersWithIds, settings);
    } else {
      const previewData = this.generateTournament(players, playersPerGroup, qualifiedPerGroup, settings);
      groups = await this.db.createGroups(tournamentId, previewData.groups);
      playersWithIds = await this.db.createPlayersGroups(tournamentId, groups);
      data = this.generateTournament(playersWithIds, playersPerGroup, qualifiedPerGroup, settings);
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
