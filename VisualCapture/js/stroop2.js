document.addEventListener("DOMContentLoaded", function () {
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var wordLeftEl = document.getElementById("word-left");
    var wordRightEl = document.getElementById("word-right");

    var btnLeft = document.getElementById("btn-left");   // Так  (←)
    var btnRight = document.getElementById("btn-right");  // Ні   (→)

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    var colors = [
        { name: "Червоний",   value: "#ef4444" },
        { name: "Чорний",     value: "#111827" },
        { name: "Зелений",    value: "#22c55e" },
        { name: "Синій",      value: "#3b82f6" },
        { name: "Жовтий",     value: "#eab308" },
        { name: "Фіолетовий", value: "#8b5cf6" },
        { name: "Рожевий",    value: "#ec4899" }
    ];

    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        // The correct answer for current round: true = "Так", false = "Ні"
        correctAnswer: false,
        timerId: null,
        running: false
    };

    var audioContext = null;

    /* ——— Helpers ——— */
    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function pickRandomExcluding(list, excludeName) {
        var filtered = list.filter(function (c) { return c.name !== excludeName; });
        return pickRandom(filtered);
    }

    /* ——— Audio ——— */
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

    function playCorrect() {
        playTone(660, 0.12, "sine");
        setTimeout(function () { playTone(880, 0.15, "sine"); }, 80);
    }

    function playWrong() {
        playTone(220, 0.3, "sawtooth");
    }

    /* ——— UI ——— */
    function updateHeader() {
        timeEl.textContent = state.time;
        scoreEl.textContent = state.correct;
        livesEl.textContent = "❤️".repeat(state.lives);
    }

    /*
        Round logic:
        - Left card: shows a COLOR NAME written in SOME ink color
        - Right card: shows a WORD written in SOME ink color
        - Question: does the color NAME on the LEFT equal the INK COLOR on the RIGHT?

        ~50% chance the answer is "Так" to keep it fair.
    */
    function buildRound() {
        var shouldMatch = Math.random() < 0.4; // 40% match rate

        // Pick the color NAME that the left card will display
        var leftColorObj = pickRandom(colors);
        // Left card ink — any color different from the name (to make it tricky)
        var leftInk = pickRandomExcluding(colors, leftColorObj.name);

        // Right card ink color
        var rightInkObj;
        if (shouldMatch) {
            // The right card's INK must equal the left card's NAME
            rightInkObj = leftColorObj;
        } else {
            // The right card's INK must NOT equal the left card's NAME
            rightInkObj = pickRandomExcluding(colors, leftColorObj.name);
        }

        // Right card word — must differ from its own ink AND from the left card's name
        // (to avoid the displayed word falsely suggesting a match on non-match rounds)
        var rightWordExcludes = shouldMatch
            ? rightInkObj.name          // only exclude own ink colour
            : leftColorObj.name;        // also exclude left name so word can't mislead
        var rightWordObj = pickRandomExcluding(colors, rightWordExcludes);

        // Set left card
        wordLeftEl.textContent = leftColorObj.name;
        wordLeftEl.style.color = leftInk.value;
        if (leftInk.value.toLowerCase() === "#ffffff") {
            wordLeftEl.style.textShadow = "0 2px 0 rgba(17, 24, 39, 0.25)";
        } else {
            wordLeftEl.style.textShadow = "none";
        }

        // Set right card
        wordRightEl.textContent = rightWordObj.name;
        wordRightEl.style.color = rightInkObj.value;
        if (rightInkObj.value.toLowerCase() === "#ffffff") {
            wordRightEl.style.textShadow = "0 2px 0 rgba(17, 24, 39, 0.25)";
        } else {
            wordRightEl.style.textShadow = "none";
        }

        state.correctAnswer = shouldMatch;
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

        var countdownId = setInterval(function () {
            playBeep();
            count -= 1;
            if (count > 0) {
                countdownEl.textContent = count;
                return;
            }
            clearInterval(countdownId);
            countdownEl.classList.add("hidden");
            state.running = true;
            startTimer();
            buildRound();
        }, 1000);
    }

    /* ——— Answer handling ——— */
    var answerLocked = false;

    function handleAnswer(playerSaidYes) {
        if (!state.running || answerLocked) return;

        state.total += 1;
        var isCorrect = (playerSaidYes === state.correctAnswer);
        var activeBtn = playerSaidYes ? btnLeft : btnRight;

        if (isCorrect) {
            state.correct += 1;
            playCorrect();
            activeBtn.classList.add("flash-correct");
        } else {
            state.lives -= 1;
            playWrong();
            activeBtn.classList.add("flash-wrong");
        }

        updateHeader();

        // Brief lock to show feedback
        answerLocked = true;
        setTimeout(function () {
            activeBtn.classList.remove("flash-correct", "flash-wrong");
            answerLocked = false;

            if (state.lives <= 0) {
                endGame();
                return;
            }
            buildRound();
        }, 300);
    }

    /* ——— Persistence ——— */
    function saveResult() {
        var entry = {
            correct: state.correct,
            total: state.total,
            player: GameAnalytics.getPlayerName(),
            date: new Date().toISOString().slice(0, 10)
        };
        var stored = JSON.parse(localStorage.getItem("stroop2Results") || "[]");
        stored.push(entry);
        localStorage.setItem("stroop2Results", JSON.stringify(stored));
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
        state.correctAnswer = false;
        state.running = false;
        answerLocked = false;
        updateHeader();
        resultEl.classList.remove("visible");

        wordLeftEl.textContent = "—";
        wordLeftEl.style.color = "#111827";
        wordLeftEl.style.textShadow = "none";
        wordRightEl.textContent = "—";
        wordRightEl.style.color = "#111827";
        wordRightEl.style.textShadow = "none";

        stopResumeBtn.textContent = "Зупинити";
        isPaused = false;

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

    // ← Так
    btnLeft.addEventListener("click", function () {
        handleAnswer(true);
    });

    // → Ні
    btnRight.addEventListener("click", function () {
        handleAnswer(false);
    });

    // Keyboard: ArrowLeft = Так, ArrowRight = Ні
    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            handleAnswer(true);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            handleAnswer(false);
        }
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
