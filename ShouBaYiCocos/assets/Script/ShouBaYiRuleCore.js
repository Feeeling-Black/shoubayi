var ShouBaYiRuleCore = (function () {
    var seats = ['A', 'B', 'C', 'D'];
    var sequenceRanks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    function teamOf(seat) {
        return seat === 'A' || seat === 'C' ? 'AC' : 'BD';
    }

    function seatsOfTeam(team) {
        return team === 'AC' ? ['A', 'C'] : ['B', 'D'];
    }

    function teammateOf(seat) {
        if (seat === 'A') return 'C';
        if (seat === 'C') return 'A';
        if (seat === 'B') return 'D';
        return 'B';
    }

    function rankPower(rank, levelRank) {
        if (rank === 'BJ') return 1000;
        if (rank === 'SJ') return 900;
        if (rank === 'LZ') return -1;
        if (rank === levelRank) return 800;
        if (rank === '2') return 700;
        return sequenceRanks.indexOf(rank) + 1;
    }

    function cardLabel(card) {
        if (!card) return '';
        if (card.rank === 'LZ') return 'LZ';
        if (card.rank === 'BJ') return card.label || '大王';
        if (card.rank === 'SJ') return card.label || '小王';
        return card.label || (card.rank + (card.suit || ''));
    }

    function tributeText(cards) {
        if (!cards.length) return '无';
        return cards.map(function (item) {
            return item.seat + ':' + cardLabel(item.card);
        }).join('，');
    }

    function highestNonLaizi(hand, levelRank) {
        var list = hand.filter(function (card) { return card.rank !== 'LZ' && !card.isLaizi; });
        list.sort(function (a, b) { return rankPower(b.rank, levelRank) - rankPower(a.rank, levelRank); });
        return list[0] || null;
    }

    function hasPureJokers(hand, count) {
        var big = 0;
        var small = 0;
        for (var i = 0; i < hand.length; i += 1) {
            if (hand[i].rank === 'BJ') big += 1;
            if (hand[i].rank === 'SJ') small += 1;
        }
        return big >= count || small >= count;
    }

    function isLaizi(card) {
        return card.rank === 'LZ' || card.isLaizi;
    }

    function groupByRank(cards) {
        var groups = {};
        for (var i = 0; i < cards.length; i += 1) {
            var rank = cards[i].rank;
            if (!groups[rank]) groups[rank] = [];
            groups[rank].push(cards[i]);
        }
        return groups;
    }

    function sortSequenceRanks(a, b) {
        return sequenceRanks.indexOf(a) - sequenceRanks.indexOf(b);
    }

    function consecutiveRanks(orderedRanks) {
        for (var i = 1; i < orderedRanks.length; i += 1) {
            if (sequenceRanks.indexOf(orderedRanks[i]) !== sequenceRanks.indexOf(orderedRanks[i - 1]) + 1) {
                return false;
            }
        }
        return true;
    }

    function validSequenceRanks(ordered, levelRank) {
        for (var i = 0; i < ordered.length; i += 1) {
            var rank = ordered[i];
            if (sequenceRanks.indexOf(rank) < 0) return false;
            if (rank === levelRank) return false;
            if (rank === '2' || rank === 'SJ' || rank === 'BJ') return false;
        }
        return true;
    }

    function analyzeCards(cards, levelRank) {
        if (!cards.length) return null;
        var laizi = [];
        var natural = [];
        for (var i = 0; i < cards.length; i += 1) {
            if (isLaizi(cards[i])) laizi.push(cards[i]);
            else natural.push(cards[i]);
        }
        if (!natural.length) return null;

        if (cards.length === 4 && cards.every(function (card) { return card.rank === 'BJ'; })) {
            return { type: 'JOKER_BOMB_BIG', groupSize: 4, total: 4, mainRank: 'BJ', isBomb: true, label: '大王炸' };
        }
        if (cards.length === 4 && cards.every(function (card) { return card.rank === 'SJ'; })) {
            return { type: 'JOKER_BOMB_SMALL', groupSize: 4, total: 4, mainRank: 'SJ', isBomb: true, label: '小王炸' };
        }

        var sameGroups = groupByRank(natural);
        var sameRanks = Object.keys(sameGroups);
        if (sameRanks.length === 1) {
            var rank = natural[0].rank;
            if (rank === 'BJ' || rank === 'SJ') {
                if (!laizi.length) {
                    return {
                        type: 'SAME_RANK',
                        groupSize: natural.length,
                        total: natural.length,
                        mainRank: rank,
                        label: natural.length === 1 ? (rank === 'BJ' ? '单张大王' : '单张小王') : natural.length + '张' + (rank === 'BJ' ? '大王' : '小王')
                    };
                }
            } else if (!laizi.length && natural.length >= 8) {
                return { type: 'BOMB', groupSize: natural.length, total: natural.length, mainRank: rank, isBomb: true, label: natural.length + '张' + rank + '炸弹' };
            } else {
                return { type: 'SAME_RANK', groupSize: cards.length, total: cards.length, mainRank: rank, laiziUsed: laizi.length, label: cards.length === 1 ? '单张' + rank : cards.length + '张' + rank };
            }
        }

        if (!laizi.length && cards.length >= 6) {
            var singleRanks = [];
            for (var s = 0; s < natural.length; s += 1) {
                if (singleRanks.indexOf(natural[s].rank) < 0) singleRanks.push(natural[s].rank);
            }
            var orderedSingle = singleRanks.sort(sortSequenceRanks);
            if (singleRanks.length === cards.length && validSequenceRanks(orderedSingle, levelRank) && consecutiveRanks(orderedSingle)) {
                return { type: 'STRAIGHT', groupSize: 1, total: cards.length, mainRank: orderedSingle[orderedSingle.length - 1], sequenceLength: orderedSingle.length, label: '单顺' };
            }
        }

        if (cards.length >= 6) {
            var groups = groupByRank(natural);
            var ordered = Object.keys(groups).sort(sortSequenceRanks);
            if (ordered.length >= 2 && validSequenceRanks(ordered, levelRank) && consecutiveRanks(ordered)) {
                for (var g = 0; g < ordered.length; g += 1) {
                    if (groups[ordered[g]].length >= 8) return null;
                }
                for (var groupSize = 2; groupSize <= 7; groupSize += 1) {
                    var needed = 0;
                    var ok = true;
                    for (var o = 0; o < ordered.length; o += 1) {
                        var count = groups[ordered[o]].length;
                        if (count > groupSize) ok = false;
                        needed += groupSize - count;
                    }
                    if (ok && needed === laizi.length && groupSize * ordered.length === cards.length) {
                        return { type: 'MULTI_RUN', groupSize: groupSize, total: cards.length, mainRank: ordered[ordered.length - 1], sequenceLength: ordered.length, laiziUsed: laizi.length, label: groupSize === 2 ? '连对' : groupSize + '张连' };
                    }
                }
            }
        }
        return null;
    }

    function canBeatCards(cards, previousAnalysis, levelRank) {
        var current = analyzeCards(cards, levelRank);
        if (!current) return false;
        if (!previousAnalysis) return true;
        if (current.isBomb || previousAnalysis.isBomb) {
            if (!current.isBomb) return false;
            if (!previousAnalysis.isBomb) return true;
            var jokerPower = { JOKER_BOMB_BIG: 3, JOKER_BOMB_SMALL: 2, BOMB: 1 };
            var diff = (jokerPower[current.type] || 0) - (jokerPower[previousAnalysis.type] || 0);
            if (diff) return diff > 0;
            if (current.total !== previousAnalysis.total) return current.total > previousAnalysis.total;
            return rankPower(current.mainRank, levelRank) > rankPower(previousAnalysis.mainRank, levelRank);
        }
        if (current.type !== previousAnalysis.type) return false;
        if (current.total !== previousAnalysis.total) return false;
        if (current.groupSize !== previousAnalysis.groupSize) return false;
        if ((current.sequenceLength || 0) !== (previousAnalysis.sequenceLength || 0)) return false;
        return rankPower(current.mainRank, levelRank) > rankPower(previousAnalysis.mainRank, levelRank);
    }

    function naturalRankGroups(hand, levelRank) {
        var groups = groupByRank(hand.filter(function (card) { return !isLaizi(card); }));
        var list = [];
        for (var rank in groups) list.push(groups[rank]);
        list.sort(function (a, b) {
            return rankPower(a[0].rank, levelRank) - rankPower(b[0].rank, levelRank);
        });
        return list;
    }

    function chooseLeadCards(hand, levelRank) {
        var laizi = hand.filter(isLaizi);
        var groups = naturalRankGroups(hand, levelRank);
        for (var i = 0; i < groups.length; i += 1) {
            var group = groups[i];
            if (group.length >= 8) continue;
            var candidate = group.length === 4 && (group[0].rank === 'BJ' || group[0].rank === 'SJ') ? [group[0]] : group;
            if (laizi.length && group[0].rank !== 'BJ' && group[0].rank !== 'SJ' && candidate.length + laizi.length === hand.length) {
                var finishCandidate = candidate.concat(laizi);
                if (analyzeCards(finishCandidate, levelRank)) return finishCandidate;
            }
            if (analyzeCards(candidate, levelRank)) return candidate;
        }
        for (var j = 0; j < groups.length; j += 1) {
            var fillGroup = groups[j];
            if (fillGroup.length >= 8) continue;
            if (fillGroup[0].rank === 'BJ' || fillGroup[0].rank === 'SJ') continue;
            for (var useLaizi = 1; useLaizi <= laizi.length; useLaizi += 1) {
                var fillCandidate = fillGroup.concat(laizi.slice(0, useLaizi));
                if (analyzeCards(fillCandidate, levelRank)) return fillCandidate;
            }
        }
        return [];
    }

    function chooseFollowCards(hand, previousAnalysis, levelRank) {
        if (!previousAnalysis) return [];
        var needSize = previousAnalysis.total || previousAnalysis.totalCards || 0;
        var laizi = hand.filter(isLaizi);
        var groups = naturalRankGroups(hand, levelRank);
        for (var i = 0; i < groups.length; i += 1) {
            if (groups[i].length < needSize) continue;
            var candidate = groups[i].slice(0, needSize);
            if (canBeatCards(candidate, previousAnalysis, levelRank)) return candidate;
        }
        for (var j = 0; j < groups.length; j += 1) {
            if (groups[j][0].rank === 'BJ' || groups[j][0].rank === 'SJ') continue;
            var missing = needSize - groups[j].length;
            if (missing <= 0 || missing > laizi.length) continue;
            var fillCandidate = groups[j].concat(laizi.slice(0, missing));
            if (canBeatCards(fillCandidate, previousAnalysis, levelRank)) return fillCandidate;
        }
        return [];
    }

    function buildTribute(result, hands, levelRank, random) {
        var rand = random || Math.random;
        var loserSeats = result.tributeLoserSeats || seatsOfTeam(result.loserTeam);
        var winnerSeats = seatsOfTeam(result.winnerTeam);
        var i;

        for (i = 0; i < loserSeats.length; i += 1) {
            if (hasPureJokers(hands[loserSeats[i]], 4)) {
                var reverseCards = [];
                for (var w = 0; w < winnerSeats.length; w += 1) {
                    var winCard = highestNonLaizi(hands[winnerSeats[w]], levelRank);
                    if (winCard) reverseCards.push({ seat: winnerSeats[w], card: winCard });
                }
                return {
                    mode: '反贡',
                    modeKey: 'REVERSE',
                    cards: reverseCards,
                    contributorSeats: winnerSeats.slice(),
                    receiverSeats: loserSeats.slice(),
                    assignments: [],
                    nextStarterSeat: result.firstFinishedSeat,
                    summary: '下一局进贡预览：触发反贡。赢家贡出：' + tributeText(reverseCards)
                };
            }
        }

        for (i = 0; i < loserSeats.length; i += 1) {
            if (hasPureJokers(hands[loserSeats[i]], 3)) {
                return {
                    mode: '抗贡',
                    modeKey: 'RESIST',
                    cards: [],
                    contributorSeats: loserSeats.slice(),
                    receiverSeats: [],
                    assignments: [],
                    nextStarterSeat: result.firstFinishedSeat,
                    summary: '下一局进贡预览：触发抗贡，本局免进贡。'
                };
            }
        }

        var cards = [];
        for (i = 0; i < loserSeats.length; i += 1) {
            var card = highestNonLaizi(hands[loserSeats[i]], levelRank);
            if (card) cards.push({ seat: loserSeats[i], card: card });
        }

        var receiverSeats = [];
        if (cards.length === 1) {
            receiverSeats = [winnerSeats.indexOf(result.firstFinishedSeat) >= 0 ? result.firstFinishedSeat : winnerSeats[0]];
        } else if (cards.length > 1) {
            receiverSeats = winnerSeats.slice();
        }

        var nextStarterSeat = result.firstFinishedSeat;
        if (cards.length === 1) {
            nextStarterSeat = cards[0].seat;
        } else if (cards.length > 1) {
            nextStarterSeat = cards[Math.floor(rand() * cards.length)].seat;
        }

        var assignments = [];
        for (i = 0; i < cards.length; i += 1) {
            assignments.push({
                fromSeat: cards[i].seat,
                receiveSeat: receiverSeats[i] || receiverSeats[0],
                card: cards[i].card
            });
        }

        return {
            mode: cards.length ? '常规进贡' : '无进贡',
            modeKey: cards.length ? 'NORMAL' : 'NONE',
            cards: cards,
            contributorSeats: loserSeats.slice(),
            receiverSeats: receiverSeats,
            assignments: assignments,
            nextStarterSeat: nextStarterSeat,
            summary: cards.length
                ? '下一局进贡预览：常规进贡。本次进贡人数 ' + cards.length + ' 人。输家贡牌池：' + tributeText(cards)
                : '下一局进贡预览：无人需要进贡。'
        };
    }

    function nextLeadAfterTrick(winner, activeSeats) {
        if (activeSeats.indexOf(winner) >= 0) {
            return {
                seat: winner,
                catchWind: false,
                reason: winner + ' 获得下一轮首出。'
            };
        }

        var teammate = teammateOf(winner);
        if (activeSeats.indexOf(teammate) >= 0) {
            return {
                seat: teammate,
                catchWind: true,
                fromSeat: winner,
                reason: '触发“车”：' + winner + ' 已出完且无人压住，队友 ' + teammate + ' 接风首出。'
            };
        }

        for (var i = 0; i < seats.length; i += 1) {
            if (activeSeats.indexOf(seats[i]) >= 0) {
                return {
                    seat: seats[i],
                    catchWind: false,
                    reason: seats[i] + ' 获得下一轮首出。'
                };
            }
        }

        return {
            seat: winner,
            catchWind: false,
            reason: winner + ' 获得下一轮首出。'
        };
    }

    return {
        teamOf: teamOf,
        seatsOfTeam: seatsOfTeam,
        teammateOf: teammateOf,
        rankPower: rankPower,
        cardLabel: cardLabel,
        tributeText: tributeText,
        highestNonLaizi: highestNonLaizi,
        hasPureJokers: hasPureJokers,
        isLaizi: isLaizi,
        groupByRank: groupByRank,
        consecutiveRanks: consecutiveRanks,
        sortSequenceRanks: sortSequenceRanks,
        validSequenceRanks: validSequenceRanks,
        analyzeCards: analyzeCards,
        canBeatCards: canBeatCards,
        naturalRankGroups: naturalRankGroups,
        chooseLeadCards: chooseLeadCards,
        chooseFollowCards: chooseFollowCards,
        buildTribute: buildTribute,
        nextLeadAfterTrick: nextLeadAfterTrick
    };
}());

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShouBaYiRuleCore;
}
