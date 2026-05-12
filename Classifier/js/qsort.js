document.addEventListener("DOMContentLoaded", function () {
    /* ——— DOM refs ——— */
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var gameCardEl = document.getElementById("game-card");
    var cardFigureEl = document.getElementById("card-figure");
    var taskLabelEl = document.getElementById("task-label");

    var btnSun = document.getElementById("btn-sun");
    var btnCloud = document.getElementById("btn-cloud");
    var btnDrop = document.getElementById("btn-drop");

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    /* ——— Config ——— */
    // Three categories: figure name, color name, SVG path, CSS color class
    var categories = [
        { name: "sun",   color: "yellow", svg: "./svgs/sun.svg",     colorClass: "color-yellow" },
        { name: "cloud", color: "grey",   svg: "./svgs/cloude.svg",  colorClass: "color-grey" },
        { name: "drop",  color: "blue",   svg: "./svgs/drop.svg",    colorClass: "color-blue" }
    ];

    var answerMap = {
        sun: 0,
        cloud: 1,
        drop: 2
    };

    /* ——— State ——— */
    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        correctAnswer: "", // "sun", "cloud" or "drop"
        isMatch: false,
        timerId: null,
        running: false
    };

    var answerLocked = false;

    /* ——— Audio ——— */
    var audioContext = null;

    function initAudio() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return; }
        }
        if (audioContext && audioContext.state === "suspended") {
            audioContext.resume().catch(function () {});
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

    function playBeep() { playTone(880, 0.12, "sine"); }
    function playCorrect() {
        playTone(660, 0.12, "sine");
        setTimeout(function () { playTone(880, 0.15, "sine"); }, 80);
    }
    function playWrong() { playTone(200, 0.3, "sawtooth"); }

    /* ——— Helpers ——— */
    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function updateHeader() {
        timeEl.textContent = state.time;
        scoreEl.textContent = state.correct;
        livesEl.textContent = "\u2764\uFE0F".repeat(Math.max(0, state.lives));
    }

    /* ——— Build round ——— */
    /*
     * Rules:
     * - A card shows a random figure (sun/cloud/drop) in a random color (yellow/grey/blue)
     * - Each answer button = figure + color pair: sun=yellow, cloud=grey, drop=blue
     * - If BOTH figure AND color of the card match one answer → that's the correct answer
     * - If NEITHER matches any single answer (color points to one, figure to another) →
     *   the correct answer is the THIRD category (the one where neither figure nor color match)
     * - If only color matches an answer but figure doesn't (or vice versa) →
     *   pick the one where NEITHER the figure NOR the color matches
     */
    function buildRound() {
        // Pick random figure and random color (independently)
        var figureIndex = Math.floor(Math.random() * 3);
        var colorIndex = Math.floor(Math.random() * 3);

        var figure = categories[figureIndex]; // which SVG to show
        var color = categories[colorIndex];   // which background color

        // Display card
        gameCardEl.className = "game-card " + color.colorClass;
        cardFigureEl.innerHTML = "<img src=\"" + figure.svg + "\" alt=\"" + figure.name + "\">";

        // Determine correct answer
        if (figureIndex === colorIndex) {
            // Both match the same category → answer is that category
            state.correctAnswer = categories[figureIndex].name;
            state.isMatch = true;
        } else {
            // Figure belongs to one category, color to another
            // The answer is the THIRD one (where neither figure nor color match)
            for (var i = 0; i < 3; i++) {
                if (i !== figureIndex && i !== colorIndex) {
                    state.correctAnswer = categories[i].name;
                    break;
                }
            }
            state.isMatch = false;
        }

        // Update task label
        if (taskLabelEl) {
            taskLabelEl.textContent = state.isMatch ? "Збігається" : "Не збігається";
            taskLabelEl.style.color = state.isMatch ? "#16a34a" : "#dc2626";
        }
    }

    /* ——— Answer ——— */
    function handleAnswer(answer) {
        if (!state.running || answerLocked) return;

        state.total += 1;
        var isCorrect = (answer === state.correctAnswer);

        var btnMap = { sun: btnSun, cloud: btnCloud, drop: btnDrop };
        var activeBtn = btnMap[answer];

        answerLocked = true;

        if (isCorrect) {
            state.correct += 1;
            playCorrect();
            if (activeBtn) activeBtn.classList.add("flash-correct");
            gameCardEl.classList.add("flash-correct");
        } else {
            state.lives -= 1;
            playWrong();
            if (activeBtn) activeBtn.classList.add("flash-wrong");
            gameCardEl.classList.add("flash-wrong");
        }

        updateHeader();

        setTimeout(function () {
            if (activeBtn) activeBtn.classList.remove("flash-correct", "flash-wrong");
            gameCardEl.classList.remove("flash-correct", "flash-wrong");
            answerLocked = false;

            if (state.lives <= 0) {
                endGame();
                return;
            }

            buildRound();
        }, 350);
    }

    /* ——— Timer ——— */
    function tick() {
        if (!state.running) return;
        state.time -= 1;
        updateHeader();
        if (state.time <= 0) {
            endGame();
        }
    }

    function startTimer() {
        clearInterval(state.timerId);
        state.timerId = setInterval(tick, 1000);
    }

    /* ——— Countdown ——— */
    function showCountdown() {
        GameAnalytics.send("game_start", { time: state.time, lives: state.lives });
        var count = 3;
        countdownEl.textContent = count;
        countdownEl.classList.remove("hidden");
        playBeep();

        var countdownId = setInterval(function () {
            count -= 1;
            if (count > 0) {
                countdownEl.textContent = count;
                playBeep();
                return;
            }
            clearInterval(countdownId);
            countdownEl.classList.add("hidden");
            state.running = true;
            startTimer();
            buildRound();
        }, 1000);
    }

    /* ——— Persistence ——— */
    function saveResult() {
        var entry = {
            correct: state.correct,
            total: state.total,
            player: GameAnalytics.getPlayerName(),
            date: new Date().toISOString().slice(0, 10)
        };
        var stored = JSON.parse(localStorage.getItem("qSortResults") || "[]");
        stored.push(entry);
        localStorage.setItem("qSortResults", JSON.stringify(stored));
        return stored;
    }

    function renderBest(list) {
        var sorted = list
            .slice()
            .sort(function (a, b) { return b.correct - a.correct; })
            .slice(0, 5);

        bestListEl.innerHTML = "";
        if (sorted.length === 0) {
            bestListEl.innerHTML = "<li>Результатів ще немає</li>";
            return;
        }

        sorted.forEach(function (item, index) {
            var li = document.createElement("li");
            li.innerHTML =
                "<span>" + (index + 1) + ". " + (item.player || "—") + " — " + item.correct + " / " + item.total + "</span>" +
                "<span>" + item.date + "</span>";
            bestListEl.appendChild(li);
        });
    }

    function endGame() {
        state.running = false;
        if (taskLabelEl) taskLabelEl.textContent = "";
        clearInterval(state.timerId);
        correctEl.textContent = state.correct;
        totalEl.textContent = state.total;
        var results = saveResult();
        renderBest(results);
        resultEl.classList.add("visible");
        GameAnalytics.send("game_end", { correct: state.correct, total: state.total });
        setTimeout(function () { GameWidgets.renderLeaderboardInline(); }, 500);
    }

    function resetGame(toStartScreen) {
        clearInterval(state.timerId);
        state.time = 180;
        state.lives = 5;
        state.total = 0;
        state.correct = 0;
        state.correctAnswer = "";
        state.running = false;
        answerLocked = false;
        updateHeader();
        resultEl.classList.remove("visible");

        stopResumeBtn.textContent = "Зупинити";
        isPaused = false;

        gameCardEl.className = "game-card";
        cardFigureEl.innerHTML = "";

        if (toStartScreen) {
            startScreenEl.style.display = "flex";
            stopResumeBtn.style.display = "none";
            countdownEl.classList.add("hidden");
        } else {
            showCountdown();
        }
    }

    /* ——— Pause / Resume ——— */
    var isPaused = false;

    stopResumeBtn.addEventListener("click", function () {
        if (!state.running && !isPaused) return;

        if (isPaused) {
            stopResumeBtn.textContent = "Зупинити";
            state.running = true;
            startTimer();
        } else {
            stopResumeBtn.textContent = "Продовжити";
            state.running = false;
            clearInterval(state.timerId);
        }

        isPaused = !isPaused;
    });

    /* ——— Event listeners ——— */
    startBtn.addEventListener("click", function () {
        GameAnalytics.ensurePlayerName();
        initAudio();
        startScreenEl.style.display = "none";
        stopResumeBtn.style.display = "inline-flex";
        showCountdown();
    });

    btnSun.addEventListener("click", function () { handleAnswer("sun"); });
    btnCloud.addEventListener("click", function () { handleAnswer("cloud"); });
    btnDrop.addEventListener("click", function () { handleAnswer("drop"); });

    // Keyboard: ← = sun, ↓ = cloud, → = drop
    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); handleAnswer("sun"); }
        else if (e.key === "ArrowDown") { e.preventDefault(); handleAnswer("cloud"); }
        else if (e.key === "ArrowRight") { e.preventDefault(); handleAnswer("drop"); }
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
