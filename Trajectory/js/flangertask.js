document.addEventListener("DOMContentLoaded", function () {
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var flockEl = document.getElementById("flock");
    var birdEls = [
        document.getElementById("bird-0"),
        document.getElementById("bird-1"),
        document.getElementById("bird-2"),
        document.getElementById("bird-3"),
        document.getElementById("bird-4")
    ];

    var btnLeft = document.getElementById("btn-left");
    var btnUp = document.getElementById("btn-up");
    var btnDown = document.getElementById("btn-down");
    var btnRight = document.getElementById("btn-right");

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    /* ——— Directions ——— */
    var directions = ["up", "down", "left", "right"];

    var dirToRotation = {
        up: 0,
        right: 90,
        down: 180,
        left: 270
    };

    /* ——— Layout patterns ——— */
    var layouts = ["layout-row", "layout-column", "layout-cross", "layout-arrow"];

    /* ——— State ——— */
    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        answer: "", // correct direction of center bird
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
            } catch (e) {
                return;
            }
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
        livesEl.textContent = "❤️".repeat(Math.max(0, state.lives));
    }

    /* ——— Build round ——— */
    function buildRound() {
        // Pick direction for the center bird
        var centerDir = pickRandom(directions);

        state.answer = centerDir;

        // Pick random layout
        var layout = pickRandom(layouts);
        flockEl.className = "flock " + layout;

        // Render birds: each flanker independently picks a random direction
        for (var i = 0; i < 5; i++) {
            var dir = (i === 2) ? centerDir : pickRandom(directions);
            var rotation = dirToRotation[dir];
            birdEls[i].innerHTML = "<img src=\"./images/bird.png\" alt=\"\u041f\u0442\u0430\u0448\u043a\u0430\" style=\"transform: rotate(" + rotation + "deg);\">";
        }

        // Position the whole flock randomly within the stage
        // We measure after a short frame so the layout is known
        requestAnimationFrame(function () {
            var stageW = flockEl.parentElement.clientWidth;
            var stageH = flockEl.parentElement.clientHeight;
            var flockW = flockEl.offsetWidth || 200;
            var flockH = flockEl.offsetHeight || 100;
            var padding = 10;
            var maxLeft = Math.max(0, stageW - flockW - padding * 2);
            var maxTop  = Math.max(0, stageH - flockH - padding * 2);
            var randLeft = padding + Math.random() * maxLeft;
            var randTop  = padding + Math.random() * maxTop;
            flockEl.style.left = randLeft + "px";
            flockEl.style.top  = randTop  + "px";
        });
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

    /* ——— Answer handling ——— */
    function handleAnswer(dir) {
        if (!state.running || answerLocked) return;

        state.total += 1;
        var isCorrect = (dir === state.answer);

        // Find which button was pressed
        var btnMap = { left: btnLeft, up: btnUp, down: btnDown, right: btnRight };
        var activeBtn = btnMap[dir];

        answerLocked = true;

        if (isCorrect) {
            state.correct += 1;
            playCorrect();
            if (activeBtn) activeBtn.classList.add("flash-correct");
            flockEl.classList.add("flash-correct");
        } else {
            state.lives -= 1;
            playWrong();
            if (activeBtn) activeBtn.classList.add("flash-wrong");
            flockEl.classList.add("flash-wrong");
        }

        updateHeader();

        setTimeout(function () {
            // Remove feedback
            if (activeBtn) activeBtn.classList.remove("flash-correct", "flash-wrong");
            flockEl.classList.remove("flash-correct", "flash-wrong");
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
        var stored = JSON.parse(localStorage.getItem("flankerTaskResults") || "[]");
        stored.push(entry);
        localStorage.setItem("flankerTaskResults", JSON.stringify(stored));
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
        state.answer = "";
        state.running = false;
        answerLocked = false;
        updateHeader();
        resultEl.classList.remove("visible");

        stopResumeBtn.textContent = "Зупинити";
        isPaused = false;

        // Clear birds
        for (var i = 0; i < 5; i++) {
            birdEls[i].innerHTML = "";
        }

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

    btnLeft.addEventListener("click", function () { handleAnswer("left"); });
    btnUp.addEventListener("click", function () { handleAnswer("up"); });
    btnDown.addEventListener("click", function () { handleAnswer("down"); });
    btnRight.addEventListener("click", function () { handleAnswer("right"); });

    // Keyboard: arrow keys
    document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); handleAnswer("left"); }
        else if (e.key === "ArrowUp") { e.preventDefault(); handleAnswer("up"); }
        else if (e.key === "ArrowDown") { e.preventDefault(); handleAnswer("down"); }
        else if (e.key === "ArrowRight") { e.preventDefault(); handleAnswer("right"); }
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
