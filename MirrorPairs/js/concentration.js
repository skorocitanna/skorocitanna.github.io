document.addEventListener("DOMContentLoaded", function () {
    var timeEl = document.getElementById("time");
    var levelEl = document.getElementById("level");
    var sublevelEl = document.getElementById("sublevel");
    var movesEl = document.getElementById("moves");
    var pairsEl = document.getElementById("pairs");
    var totalPairsEl = document.getElementById("total-pairs");
    var livesEl = document.getElementById("lives");
    var boardEl = document.getElementById("board");
    var startScreenEl = document.getElementById("start-screen");
    var countdownEl = document.getElementById("countdown");
    var resultEl = document.getElementById("result");
    var finalMovesEl = document.getElementById("final-moves");
    var finalPairsEl = document.getElementById("final-pairs");
    var playAgainBtn = document.getElementById("play-again");
    var exitBtn = document.getElementById("btn-exit");

    var levelButtons = Array.prototype.slice.call(
        document.querySelectorAll(".level-btn")
    );

    var audioContext = null;

    var images = [];
    for (var i = 1; i <= 36; i += 1) {
        images.push("./svgs/" + i + ".svg");
    }

    var state = {
        level: 1,
        sublevelIndex: 0,
        sublevels: [],
        flipped: [],
        locked: false,
        moves: 0,
        matchedPairs: 0,
        totalPairs: 0,
        lives: 5,
        maxLives: 5,
        running: false,
        time: 180,
        timerId: null
    };

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
    }

    function playBeep() {
        if (!audioContext) {
            return;
        }
        var oscillator = audioContext.createOscillator();
        var gainNode = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.15;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.12);
    }

    function shuffle(list) {
        var array = list.slice();
        for (var i = array.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    function getSublevels(level) {
        var base = [
            { rows: 2, cols: 3 },
            { rows: 2, cols: 3 },
            { rows: 2, cols: 4 },
            { rows: 3, cols: 4 },
            { rows: 3, cols: 4 }
        ];
        var add = Math.round(((level - 1) * 3) / 9);
        return base.map(function (size) {
            var rows = Math.min(6, size.rows + add);
            var cols = Math.min(6, size.cols + add);
            if ((rows * cols) % 2 !== 0) {
                if (cols < 6) {
                    cols += 1;
                } else if (rows < 6) {
                    rows += 1;
                }
            }
            return { rows: rows, cols: cols };
        });
    }

    function updateHeader() {
        if (timeEl) timeEl.textContent = state.time;
        levelEl.textContent = state.level;
        sublevelEl.textContent = state.sublevelIndex + 1;
        movesEl.textContent = state.moves;
        pairsEl.textContent = state.matchedPairs;
        totalPairsEl.textContent = state.totalPairs;
        livesEl.textContent = "❤️".repeat(state.lives);
    }

    function buildBoard(rows, cols) {
        var totalCells = rows * cols;
        var pairCount = totalCells / 2;
        var shuffledImages = shuffle(images);
        var picked = shuffledImages.slice(0, pairCount);
        var deck = shuffle(picked.concat(picked));

        boardEl.style.setProperty("--board-cols", cols);
        boardEl.innerHTML = "";

        deck.forEach(function (src, index) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "card";
            card.dataset.cardId = src + "-" + index;
            card.dataset.image = src;

            card.innerHTML =
                "<div class=\"card-inner\">" +
                "<div class=\"card-face card-back\">?</div>" +
                "<div class=\"card-face card-front\"><img src=\"" +
                src +
                "\" alt=\"Картка\"></div>" +
                "</div>";

            card.addEventListener("click", function () {
                handleCardClick(card);
            });

            boardEl.appendChild(card);
        });

        state.flipped = [];
        state.locked = false;
        state.matchedPairs = 0;
        state.totalPairs = pairCount;
        updateHeader();
    }

    function handleCardClick(card) {
        if (!state.running || state.locked || card.classList.contains("flipped") || card.classList.contains("matched")) {
            return;
        }

        card.classList.add("flipped");
        state.flipped.push(card);

        if (state.flipped.length < 2) {
            return;
        }

        state.moves += 1;
        var first = state.flipped[0];
        var second = state.flipped[1];
        var match = first.dataset.image === second.dataset.image;

        if (match) {
            first.classList.add("matched");
            second.classList.add("matched");
            state.flipped = [];
            state.matchedPairs += 1;
            updateHeader();
            if (state.matchedPairs >= state.totalPairs) {
                advanceSublevel();
            }
            return;
        }

        state.locked = true;
        state.lives -= 1;
        updateHeader();
        if (state.lives <= 0) {
            finishLevel("Життя закінчились");
            return;
        }
        setTimeout(function () {
            first.classList.remove("flipped");
            second.classList.remove("flipped");
            state.flipped = [];
            state.locked = false;
        }, 650);
        updateHeader();
    }

    function tickGameTimer() {
        if (!state.running) return;
        state.time -= 1;
        if (timeEl) timeEl.textContent = state.time;
        if (state.time <= 0) {
            finishLevel("Час вийшов!");
        }
    }

    function startGameTimer() {
        clearInterval(state.timerId);
        state.timerId = setInterval(tickGameTimer, 1000);
    }

    function startSublevel() {
        var size = state.sublevels[state.sublevelIndex];
        state.moves = 0;
        buildBoard(size.rows, size.cols);
        previewCards();
    }

    function previewCards() {
        var cards = Array.prototype.slice.call(boardEl.querySelectorAll(".card"));
        state.running = false;
        state.locked = true;
        cards.forEach(function (card) {
            card.classList.add("flipped");
        });

        setTimeout(function () {
            cards.forEach(function (card) {
                if (!card.classList.contains("matched")) {
                    card.classList.remove("flipped");
                }
            });
            state.locked = false;
            state.running = true;
        }, 6000);
    }

    function advanceSublevel() {
        if (state.sublevelIndex < state.sublevels.length - 1) {
            state.sublevelIndex += 1;
            startSublevel();
            return;
        }
        finishLevel();
    }

    function startLevel(level) {
        state.level = level;
        state.sublevels = getSublevels(level);
        state.sublevelIndex = 0;
        state.lives = state.maxLives;
        state.running = false;
        startSublevel();
        resultEl.classList.remove("visible");
        startScreenEl.classList.add("hidden");
        showCountdown();
    }

    function finishLevel(message) {
        state.running = false;
        clearInterval(state.timerId);
        state.timerId = null;
        finalMovesEl.textContent = state.moves;
        finalPairsEl.textContent = state.matchedPairs + " / " + state.totalPairs;
        resultEl.classList.add("visible");
        GameAnalytics.send("game_end", { level: state.level, moves: state.moves, matchedPairs: state.matchedPairs, totalPairs: state.totalPairs });
        setTimeout(function () { GameWidgets.renderLeaderboardInline(); }, 500);
        if (message) {
            resultEl.querySelector("h2").textContent = message;
        } else {
            resultEl.querySelector("h2").textContent = "Рівень завершено";
        }
    }

    function showCountdown() {
        GameAnalytics.send("game_start", { level: state.level });
        var count = 3;
        countdownEl.textContent = count;
        countdownEl.classList.remove("hidden");

        var countdownId = setInterval(function () {
            playBeep();
            count -= 1;
            if (count > 0) {
                countdownEl.textContent = count;
                return;
            }
            clearInterval(countdownId);
            countdownEl.classList.add("hidden");
            startGameTimer();
            state.running = true;
        }, 1000);
    }

    function showLevelSelect() {
        resultEl.classList.remove("visible");
        startScreenEl.classList.remove("hidden");
        boardEl.innerHTML = "";
        state.running = false;
        clearInterval(state.timerId);
        state.timerId = null;
        state.time = 180;
        if (timeEl) timeEl.textContent = state.time;
    }

    levelButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            var level = Number(button.dataset.level);
            GameAnalytics.ensurePlayerName();
            initAudio();
            startLevel(level);
        });
    });

    playAgainBtn.addEventListener("click", function () {
        showLevelSelect();
    });

    exitBtn.addEventListener("click", function () {
        showLevelSelect();
    });

    updateHeader();
});
