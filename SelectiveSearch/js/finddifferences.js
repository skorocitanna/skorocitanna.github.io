document.addEventListener("DOMContentLoaded", function () {
    /* ——— DOM refs ——— */
    var timeEl = document.getElementById("time");
    var levelEl = document.getElementById("level");
    var sublevelEl = document.getElementById("sublevel");
    var totalSublevelsEl = document.getElementById("total-sublevels");
    var roundEl = document.getElementById("round");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var boardEl = document.getElementById("board");
    var startScreenEl = document.getElementById("start-screen");
    var countdownEl = document.getElementById("countdown");
    var resultEl = document.getElementById("result");
    var resultTitleEl = document.getElementById("result-title");
    var resultMessageEl = document.getElementById("result-message");
    var finalScoreEl = document.getElementById("final-score");
    var finalSublevelsEl = document.getElementById("final-sublevels");
    var playAgainBtn = document.getElementById("play-again");
    var exitBtn = document.getElementById("btn-exit");
    var phaseTextEl = document.getElementById("phase-text");

    var levelButtons = Array.prototype.slice.call(
        document.querySelectorAll(".level-btn")
    );

    /* ——— SVG images pool ——— */
    var allImages = [];
    for (var i = 1; i <= 33; i++) {
        allImages.push("./svgs/1 (" + i + ").svg");
    }

    /* ——— Preload all SVGs on page load ——— */
    (function preloadAllImages() {
        allImages.forEach(function (src) {
            var img = new Image();
            img.src = src;
        });
    })();

    /* ——— Audio ——— */
    var audioContext = null;

    function initAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }
    }

    function playTone(freq, duration, type) {
        if (!audioContext) return;
        var osc = audioContext.createOscillator();
        var gain = audioContext.createGain();
        osc.type = type || "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + duration);
    }

    function playBeep() {
        playTone(880, 0.12, "sine");
    }

    function playCorrectSound() {
        playTone(660, 0.12, "sine");
        setTimeout(function () { playTone(880, 0.15, "sine"); }, 80);
    }

    function playWrongSound() {
        playTone(200, 0.3, "sawtooth");
    }

    function playLevelCompleteSound() {
        if (!audioContext) return;
        var t = audioContext.currentTime;
        [523, 659, 784, 1047].forEach(function (freq, i) {
            var osc = audioContext.createOscillator();
            var g = audioContext.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.12, t + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
            osc.connect(g);
            g.connect(audioContext.destination);
            osc.start(t + i * 0.12);
            osc.stop(t + i * 0.12 + 0.3);
        });
    }

    /* ——— Utility ——— */
    function shuffle(list) {
        var arr = list.slice();
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    /*
        ═══════════════════════════════════════════
        LEVEL CONFIGURATION

        10 levels × 5 sub-levels.

        Each sub-level is a "session" of multiple rounds.
        Round 1: memorize the initial set.
        Rounds 2+: some items are swapped for new ones → find the new ones.

        Parameters per sub-level config:
        - gridSize:    total items displayed (rows × cols)
        - cols:        grid columns
        - newPerRound: how many items get swapped each round
        - rounds:      total rounds (including the initial memorize round)
        - memorizeMs:  time to memorize (ms)

        Difficulty scales:
        - More items on the grid
        - More items swapped per round
        - More rounds
        - Less memorize time
        ═══════════════════════════════════════════
    */

    var SUB_LEVELS_COUNT = 5;

    /*
        Returns array of 5 sub-level configs for a given level (1-10).
    */
    function getSubLevelConfigs(level) {
        /*
            Level 1:  grid 2×2(4),  newPerRound 1, rounds 3-4,  memorize 4000ms
            Level 10: grid 4×5(20), newPerRound 3-4, rounds 6-7, memorize 1800ms

            Interpolate between these extremes.
        */
        var t = (level - 1) / 9; // 0..1

        var configs = [];
        for (var s = 0; s < SUB_LEVELS_COUNT; s++) {
            var st = s / (SUB_LEVELS_COUNT - 1); // 0..1 within sub-levels

            // Grid size grows with level and slightly with sub-level
            var baseItems = lerp(4, 20, t);
            var itemCount = Math.round(baseItems + st * lerp(0, 3, t));
            itemCount = clamp(itemCount, 4, 20);

            // Columns
            var cols = getColsForCount(itemCount);

            // New items per round
            var baseNew = lerp(1, 3.5, t);
            var newPerRound = Math.round(baseNew + st * lerp(0, 1, t));
            newPerRound = clamp(newPerRound, 1, Math.floor(itemCount * 0.4));

            // Rounds (including initial memorize)
            var baseRounds = lerp(3, 6, t);
            var rounds = Math.round(baseRounds + st * lerp(0, 1.5, t));
            rounds = clamp(rounds, 3, 8);

            // Memorize time
            var baseMemo = lerp(4000, 2000, t);
            var memorizeMs = Math.round(baseMemo - st * lerp(0, 600, t));
            memorizeMs = clamp(memorizeMs, 1400, 5000);

            configs.push({
                itemCount: itemCount,
                cols: cols,
                newPerRound: newPerRound,
                rounds: rounds,
                memorizeMs: memorizeMs
            });
        }

        return configs;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    }

    function getColsForCount(n) {
        if (n <= 4) return 2;
        if (n <= 6) return 3;
        if (n <= 9) return 3;
        if (n <= 12) return 4;
        if (n <= 16) return 4;
        return 5;
    }

    /* ——— State ——— */
    var state = {
        level: 1,
        sublevelIndex: 0,
        sublevelConfigs: [],
        round: 0,           // current round within sub-level (0-based)
        currentItems: [],    // array of image paths currently on board
        previousItems: [],   // items from previous round (to compare)
        newItems: [],        // which items are new this round (paths)
        foundNew: [],        // which new items player has found
        usedImages: [],      // all images used so far in this sub-level (to avoid repeats)
        score: 0,
        lives: 5,
        maxLives: 5,
        running: false,
        locked: false,
        completedSublevels: 0,
        phase: "idle",       // "idle" | "memorize" | "find" | "finished"
        time: 180,
        timerId: null
    };

    /* ——— Header ——— */
    function updateHeader() {
        if (timeEl) timeEl.textContent = state.time;
        levelEl.textContent = state.level;
        sublevelEl.textContent = state.sublevelIndex + 1;
        totalSublevelsEl.textContent = SUB_LEVELS_COUNT;
        roundEl.textContent = Math.max(1, state.round);
        scoreEl.textContent = state.score;
        livesEl.textContent = "❤️".repeat(Math.max(0, state.lives));
    }

    function setPhaseText(text, cls) {
        phaseTextEl.textContent = text;
        phaseTextEl.className = "phase-text";
        if (cls) phaseTextEl.classList.add(cls);
    }

    /* ——— Board ——— */
    function buildBoard(items, cols, isMemorize) {
        boardEl.style.setProperty("--board-cols", cols);
        boardEl.innerHTML = "";

        var shuffled = shuffle(items);

        shuffled.forEach(function (src, index) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "item animate-in";
            item.dataset.image = src;
            item.style.animationDelay = (index * 40) + "ms";

            if (isMemorize) {
                item.classList.add("memorize");
            }

            var img = document.createElement("img");
            img.src = src;
            img.alt = "Предмет";
            item.appendChild(img);

            item.addEventListener("click", function () {
                handleItemClick(item);
            });

            boardEl.appendChild(item);
        });
    }

    function tickGameTimer() {
        if (!state.running) return;
        state.time -= 1;
        if (timeEl) timeEl.textContent = state.time;
        if (state.time <= 0) {
            finishLevel("Час вийшов!", "Спробуйте ще раз.");
        }
    }

    function startGameTimer() {
        clearInterval(state.timerId);
        state.timerId = setInterval(tickGameTimer, 1000);
    }

    /* ——— Game flow ——— */

    function startLevel(level) {
        state.level = level;
        state.sublevelConfigs = getSubLevelConfigs(level);
        state.sublevelIndex = 0;
        state.score = 0;
        state.lives = state.maxLives;
        state.completedSublevels = 0;
        state.running = false;
        state.phase = "idle";
        state.time = 180;
        if (timeEl) timeEl.textContent = state.time;
        clearInterval(state.timerId);
        state.timerId = null;

        updateHeader();
        resultEl.classList.remove("visible");
        startScreenEl.classList.add("hidden");

        showCountdown(function () {
            startGameTimer();
            startSublevel();
        });
    }

    function startSublevel() {
        var cfg = state.sublevelConfigs[state.sublevelIndex];
        state.round = 0;
        state.usedImages = [];
        state.previousItems = [];
        state.currentItems = [];
        state.newItems = [];
        state.foundNew = [];

        updateHeader();

        // Pick initial set of items
        var shuffled = shuffle(allImages);
        state.currentItems = shuffled.slice(0, cfg.itemCount);
        state.usedImages = state.currentItems.slice();

        // Show memorize phase
        showMemorizePhase(cfg);
    }

    function showMemorizePhase(cfg) {
        state.phase = "memorize";
        state.round++;
        updateHeader();

        setPhaseText("Запам'ятайте ці предмети (" + Math.round(cfg.memorizeMs / 1000) + " сек)", "");
        buildBoard(state.currentItems, cfg.cols, true);

        // Disable clicks during memorize
        setItemsDisabled(true);

        setTimeout(function () {
            if (state.phase !== "memorize") return; // was interrupted
            advanceToFindPhase(cfg);
        }, cfg.memorizeMs);
    }

    function advanceToFindPhase(cfg) {
        // Check if we've done all rounds
        if (state.round >= cfg.rounds) {
            // Sub-level complete!
            state.completedSublevels++;
            playLevelCompleteSound();
            advanceSublevel();
            return;
        }

        // Swap some items for new ones
        state.previousItems = state.currentItems.slice();
        var result = swapItems(state.currentItems, state.usedImages, cfg.newPerRound);
        state.currentItems = result.newSet;
        state.newItems = result.newOnes;
        state.usedImages = state.usedImages.concat(result.newOnes);
        state.foundNew = [];

        state.round++;
        state.phase = "find";
        updateHeader();

        var newCount = state.newItems.length;
        setPhaseText("Знайдіть " + newCount + " " + pluralItems(newCount) + "!", "find-phase");
        buildBoard(state.currentItems, cfg.cols, false);
        setItemsDisabled(false);
        state.locked = false;
    }

    function swapItems(currentSet, usedSoFar, swapCount) {
        // Find images not yet used
        var available = allImages.filter(function (img) {
            return usedSoFar.indexOf(img) === -1;
        });

        // If we run out of fresh images, allow reuse of old ones (not in current set)
        if (available.length < swapCount) {
            available = allImages.filter(function (img) {
                return currentSet.indexOf(img) === -1;
            });
        }

        available = shuffle(available);

        // Pick which positions to swap
        var indices = [];
        for (var i = 0; i < currentSet.length; i++) indices.push(i);
        indices = shuffle(indices);
        var swapIndices = indices.slice(0, Math.min(swapCount, available.length));

        var newSet = currentSet.slice();
        var newOnes = [];

        for (var s = 0; s < swapIndices.length; s++) {
            var idx = swapIndices[s];
            var newImg = available[s];
            newSet[idx] = newImg;
            newOnes.push(newImg);
        }

        return { newSet: newSet, newOnes: newOnes };
    }

    function pluralItems(n) {
        if (n === 1) return "новий предмет";
        if (n >= 2 && n <= 4) return "нових предмети";
        return "нових предметів";
    }

    /* ——— Click handling ——— */
    function handleItemClick(itemEl) {
        if (state.phase !== "find" || state.locked) return;

        var imgSrc = itemEl.dataset.image;

        // Check if already found
        if (state.foundNew.indexOf(imgSrc) !== -1) return;
        if (itemEl.classList.contains("correct") || itemEl.classList.contains("wrong")) return;

        var isNew = state.newItems.indexOf(imgSrc) !== -1;

        if (isNew) {
            // Correct! Found a new item
            itemEl.classList.add("correct");
            state.foundNew.push(imgSrc);
            state.score++;
            playCorrectSound();
            updateHeader();

            // Check if all new items found
            if (state.foundNew.length >= state.newItems.length) {
                state.locked = true;
                setPhaseText("Чудово!", "success-phase");
                setTimeout(function () {
                    var cfg = state.sublevelConfigs[state.sublevelIndex];
                    // If this was the last round — go straight to next sublevel
                    // if (state.round >= cfg.rounds) {
                        state.completedSublevels++;
                        playLevelCompleteSound();
                        advanceSublevel();
                    // } else {
                        // Skip re-memorize — go directly to next find phase
                        //advanceToFindPhase(cfg);
                        // showMemorizePhase(cfg);
                        // advanceSublevel();
                    // }
                }, 1000);
            }
        } else {
            // Wrong! This item was already in the previous set
            itemEl.classList.add("wrong");
            state.lives--;
            playWrongSound();
            updateHeader();

            if (state.lives <= 0) {
                state.locked = true;
                setPhaseText("Життя закінчились!", "error-phase");
                setTimeout(function () {
                    revealNewItems();
                    setTimeout(function () {
                        finishLevel("Життя закінчились!", "Спробуйте знову.");
                    }, 1500);
                }, 500);
            }
        }
    }

    function revealNewItems() {
        var items = Array.prototype.slice.call(boardEl.querySelectorAll(".item"));
        items.forEach(function (itemEl) {
            var src = itemEl.dataset.image;
            if (state.newItems.indexOf(src) !== -1 && state.foundNew.indexOf(src) === -1) {
                itemEl.classList.add("reveal-new");
            }
            if (state.newItems.indexOf(src) === -1) {
                itemEl.classList.add("old");
            }
        });
    }

    function setItemsDisabled(disabled) {
        var items = Array.prototype.slice.call(boardEl.querySelectorAll(".item"));
        items.forEach(function (el) {
            if (disabled) {
                el.classList.add("disabled");
            } else {
                el.classList.remove("disabled");
            }
        });
    }

    /* ——— Sub-level advancement ——— */
    function advanceSublevel() {
        if (state.sublevelIndex < SUB_LEVELS_COUNT - 1) {
            state.sublevelIndex++;
            updateHeader();
            setPhaseText("Наступний субрівень...", "");
            setTimeout(function () {
                startSublevel();
            }, 1000);
            return;
        }

        // All sub-levels complete!
        finishLevel("🎉 Рівень пройдено!", "Вітаємо! Ви пройшли всі субрівні.");
    }

    function finishLevel(title, message) {
        state.running = false;
        state.phase = "idle";
        clearInterval(state.timerId);
        state.timerId = null;
        resultTitleEl.textContent = title || "Рівень завершено";
        resultMessageEl.textContent = message || "";
        finalScoreEl.textContent = state.score;
        finalSublevelsEl.textContent = state.completedSublevels + " / " + SUB_LEVELS_COUNT;
        resultEl.classList.add("visible");
        GameAnalytics.send("game_end", { level: state.level, score: state.score, completedSublevels: state.completedSublevels });
        setTimeout(function () { GameWidgets.renderLeaderboardInline(); }, 500);
    }

    /* ——— Countdown ——— */
    function showCountdown(callback) {
        GameAnalytics.send("game_start", { level: state.level });
        var count = 3;
        countdownEl.textContent = count;
        countdownEl.classList.remove("hidden");
        playBeep();

        var countdownId = setInterval(function () {
            count--;
            if (count > 0) {
                countdownEl.textContent = count;
                playBeep();
                return;
            }
            clearInterval(countdownId);
            countdownEl.classList.add("hidden");
            state.running = true;
            if (callback) callback();
        }, 1000);
    }

    /* ——— Level select ——— */
    function showLevelSelect() {
        resultEl.classList.remove("visible");
        startScreenEl.classList.remove("hidden");
        boardEl.innerHTML = "";
        state.running = false;
        state.phase = "idle";
        clearInterval(state.timerId);
        state.timerId = null;
        state.time = 180;
        if (timeEl) timeEl.textContent = state.time;
        setPhaseText("Запам'ятайте ці предмети", "");
    }

    /* ——— Event listeners ——— */
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
