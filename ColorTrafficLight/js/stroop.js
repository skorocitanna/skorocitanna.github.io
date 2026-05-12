document.addEventListener("DOMContentLoaded", function () {
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var wordEl = document.getElementById("word");
    var btnLeft = document.getElementById("btn-left");
    var btnRight = document.getElementById("btn-right");

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    var colors = [
        { name: "Червоний", value: "#ef4444" },
        { name: "Чорний", value: "#111827" },
        { name: "Зелений", value: "#22c55e" },
        { name: "Синій", value: "#3b82f6" },
        { name: "Жовтий", value: "#eab308" },
        { name: "Фіолетовий", value: "#8b5cf6" },
        { name: "Рожевий", value: "#ec4899" },
    ];

    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        // correct answer is ink color name (what you see)
        answerInkName: "",
        // shown word meaning (distractor)
        wordName: "",
        timerId: null,
        running: false
    };

    var audioContext = null;

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

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

    function updateHeader() {
        timeEl.textContent = state.time;
        scoreEl.textContent = state.correct;
        livesEl.textContent = "❤️".repeat(state.lives);
    }

    function buildRound() {
        var wordColor = pickRandom(colors);
        var inkColor;
        
        // 20% chance that text and ink color MATCH
        var shouldMatch = Math.random() < 0.20; // 20% match rate
        
        if (shouldMatch) {
            // Text and ink are the SAME color
            inkColor = wordColor;
        } else {
            // Text and ink are DIFFERENT colors (original behavior)
            inkColor = pickRandom(colors);
            while (inkColor.name === wordColor.name) {
                inkColor = pickRandom(colors);
            }
        }

        state.wordName = wordColor.name;
        state.answerInkName = inkColor.name;

        wordEl.textContent = wordColor.name;
        wordEl.style.color = inkColor.value;

        // Two buttons: one is the text (word) name, the other is ink color name.
        // When they match, we need a third different color for the other button
        var otherButtonColor;
        if (shouldMatch) {
            // Pick a color that's different from both word and ink (which are the same)
            do {
                otherButtonColor = pickRandom(colors);
            } while (otherButtonColor.name === inkColor.name);
        } else {
            // When they don't match, use the word color for the non-ink button
            otherButtonColor = wordColor;
        }

        // Shuffle sides.
        var leftIsInk = Math.random() < 0.5;
        if (leftIsInk) {
            btnLeft.textContent = inkColor.name;
            btnRight.textContent = otherButtonColor.name;
            btnLeft.dataset.kind = "ink";
            btnRight.dataset.kind = shouldMatch ? "other" : "word";
        } else {
            btnLeft.textContent = otherButtonColor.name;
            btnRight.textContent = inkColor.name;
            btnLeft.dataset.kind = shouldMatch ? "other" : "word";
            btnRight.dataset.kind = "ink";
        }

        // Ensure readable when ink is white
        if (inkColor.value.toLowerCase() === "#ffffff") {
            wordEl.style.textShadow = "0 2px 0 rgba(17, 24, 39, 0.25)";
        } else {
            wordEl.style.textShadow = "none";
        }
    }

    function tick() {
        if (!state.running) {
            return;
        }
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

    function handleChoice(kind) {
        if (!state.running) {
            return;
        }

        state.total += 1;

        // Correct answer: ink color.
        if (kind === "ink") {
            state.correct += 1;
        } else {
            state.lives -= 1;
        }

        updateHeader();

        if (state.lives <= 0) {
            endGame();
            return;
        }

        buildRound();
    }

    function saveResult() {
        var entry = {
            correct: state.correct,
            total: state.total,
            player: GameAnalytics.getPlayerName(),
            date: new Date().toISOString().slice(0, 10)
        };
        var stored = JSON.parse(localStorage.getItem("stroopResults") || "[]");
        stored.push(entry);
        localStorage.setItem("stroopResults", JSON.stringify(stored));
        return stored;
    }

    function renderBest(list) {
        var sorted = list
            .slice()
            .sort(function (a, b) {
                return b.correct - a.correct;
            })
            .slice(0, 5);

        bestListEl.innerHTML = "";
        if (sorted.length === 0) {
            bestListEl.innerHTML = "<li>Результатів ще немає</li>";
            return;
        }

        sorted.forEach(function (item, index) {
            var li = document.createElement("li");
            li.innerHTML =
                "<span>" +
                (index + 1) +
                ". " +
                (item.player || "—") +
                " — " +
                item.correct +
                " / " +
                item.total +
                "</span><span>" +
                item.date +
                "</span>";
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
        state.answerInkName = "";
        state.wordName = "";
        state.running = false;
        updateHeader();
        resultEl.classList.remove("visible");

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

    var isPaused = false;

    stopResumeBtn.addEventListener("click", function () {
        if (!state.running && !isPaused) {
            return;
        }

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

    startBtn.addEventListener("click", function () {
        GameAnalytics.ensurePlayerName();
        initAudio();
        startScreenEl.style.display = "none";
        stopResumeBtn.style.display = "inline-flex";
        showCountdown();
    });

    btnLeft.addEventListener("click", function () {
        handleChoice(btnLeft.dataset.kind);
    });

    btnRight.addEventListener("click", function () {
        handleChoice(btnRight.dataset.kind);
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
