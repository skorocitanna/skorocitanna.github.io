document.addEventListener("DOMContentLoaded", function () {
    /* ——— DOM refs ——— */
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var gameCardEl = document.getElementById("game-card");
    var cardShapeEl = document.getElementById("card-shape");
    var ruleTextEl = document.getElementById("rule-text");

    var btns = [
        document.getElementById("btn-0"),
        document.getElementById("btn-1"),
        document.getElementById("btn-2"),
        document.getElementById("btn-3")
    ];

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    /* ——— Config ——— */
    // 4 categories: index 0=square/blue, 1=circle/yellow, 2=diamond/green, 3=triangle/red
    var shapes = [
        {
            name: "square",
            label: "Квадрат",
            color: "#3b82f6",
            colorName: "blue",
            svg: function (fill) {
                return '<svg viewBox="0 0 80 80"><rect x="8" y="8" width="64" height="64" rx="6" fill="' + fill + '"/></svg>';
            }
        },
        {
            name: "circle",
            label: "Коло",
            color: "#eab308",
            colorName: "yellow",
            svg: function (fill) {
                return '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="' + fill + '"/></svg>';
            }
        },
        {
            name: "diamond",
            label: "Ромб",
            color: "#22c55e",
            colorName: "green",
            svg: function (fill) {
                return '<svg viewBox="0 0 80 80"><polygon points="40,4 76,40 40,76 4,40" fill="' + fill + '"/></svg>';
            }
        },
        {
            name: "triangle",
            label: "Трикутник",
            color: "#ef4444",
            colorName: "red",
            svg: function (fill) {
                return '<svg viewBox="0 0 80 80"><polygon points="40,6 76,72 4,72" fill="' + fill + '"/></svg>';
            }
        }
    ];

    var rules = ["shape", "color"]; // "shape" = за формою, "color" = за кольором

    /* ——— State ——— */
    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        correctIndex: -1, // index 0-3
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
    function buildRound() {
        // Pick random shape index and random color index (independently)
        var shapeIndex = Math.floor(Math.random() * 4);
        var colorIndex = Math.floor(Math.random() * 4);

        // Pick sort rule
        var rule = pickRandom(rules);

        // Show rule
        ruleTextEl.textContent = (rule === "shape") ? "ФОРМОЮ" : "КОЛЬОРОМ";

        // Determine correct answer
        if (rule === "shape") {
            // Answer is the button matching the card's shape
            state.correctIndex = shapeIndex;
        } else {
            // Answer is the button matching the card's color
            state.correctIndex = colorIndex;
        }

        // Render card: shape of shapeIndex, colored with color of colorIndex
        var fillColor = shapes[colorIndex].color;
        cardShapeEl.innerHTML = shapes[shapeIndex].svg(fillColor);
    }

    /* ——— Answer ——— */
    function handleAnswer(index) {
        if (!state.running || answerLocked) return;
        if (index < 0 || index > 3) return;

        state.total += 1;
        var isCorrect = (index === state.correctIndex);

        var activeBtn = btns[index];
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
        var stored = JSON.parse(localStorage.getItem("qSortExResults") || "[]");
        stored.push(entry);
        localStorage.setItem("qSortExResults", JSON.stringify(stored));
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
        state.correctIndex = -1;
        state.running = false;
        answerLocked = false;
        updateHeader();
        resultEl.classList.remove("visible");

        stopResumeBtn.textContent = "Зупинити";
        isPaused = false;

        gameCardEl.className = "game-card";
        cardShapeEl.innerHTML = "";
        ruleTextEl.textContent = "—";

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

    btns[0].addEventListener("click", function () { handleAnswer(0); });
    btns[1].addEventListener("click", function () { handleAnswer(1); });
    btns[2].addEventListener("click", function () { handleAnswer(2); });
    btns[3].addEventListener("click", function () { handleAnswer(3); });

    // Keyboard: ← = 0 (square), ↑ = 1 (circle), ↓ = 2 (diamond), → = 3 (triangle)
    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); handleAnswer(0); }
        else if (e.key === "ArrowUp") { e.preventDefault(); handleAnswer(1); }
        else if (e.key === "ArrowDown") { e.preventDefault(); handleAnswer(2); }
        else if (e.key === "ArrowRight") { e.preventDefault(); handleAnswer(3); }
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
