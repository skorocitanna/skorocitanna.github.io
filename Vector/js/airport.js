document.addEventListener("DOMContentLoaded", function () {
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var arenaEl = document.getElementById("arena");
    var planeEl = document.getElementById("plane");
    var btnUp = document.getElementById("btn-up");
    var btnDown = document.getElementById("btn-down");
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

    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        // ruleColor: "blue" means same direction, "red" means opposite
        ruleColor: "blue",
        planeDir: "up",
        expectedDir: "up",
        timerId: null,
        running: false
    };

    var audioContext = null;

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function oppositeDir(dir) {
        if (dir === "up") {
            return "down";
        }
        if (dir === "down") {
            return "up";
        }
        if (dir === "left") {
            return "right";
        }
        return "left";
    }

    // Car images face RIGHT (→), so right = 0° rotation
    function dirToRotation(dir) {
        if (dir === "right") return "0deg";
        if (dir === "down")  return "90deg";
        if (dir === "left")  return "180deg";
        return "270deg"; // up
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
        var dirs = ["up", "down", "left", "right"];
        state.planeDir = pickRandom(dirs);
        state.ruleColor = Math.random() < 0.5 ? "blue" : "red";

        if (state.ruleColor === "blue") {
            state.expectedDir = state.planeDir;
        } else {
            state.expectedDir = oppositeDir(state.planeDir);
        }

        // Set arena background color
        arenaEl.style.background = state.ruleColor === "blue" ? "#3b82f6" : "#ef4444";

        // Rocket faces up — rotate to current direction
        planeEl.innerHTML = "<img src='./img/rocket.png' alt='Ракета' draggable='false'>";
        planeEl.style.transform = "rotate(" + dirToRotation(state.planeDir) + ")";
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

    function handleAnswer(dir) {
        if (!state.running) {
            return;
        }

        state.total += 1;

        if (dir === state.expectedDir) {
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
        var stored = JSON.parse(localStorage.getItem("airportResults") || "[]");
        stored.push(entry);
        localStorage.setItem("airportResults", JSON.stringify(stored));
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
        state.ruleColor = "blue";
        state.planeDir = "up";
        state.expectedDir = "up";
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

    function bindArrow(btn, dir) {
        btn.addEventListener("click", function () {
            handleAnswer(dir);
        });
    }

    bindArrow(btnUp, "up");
    bindArrow(btnDown, "down");
    bindArrow(btnLeft, "left");
    bindArrow(btnRight, "right");

    document.addEventListener("keydown", function (e) {
        if (!state.running) {
            return;
        }

        var dir = null;
        if (e.key === "ArrowUp") {
            dir = "up";
        } else if (e.key === "ArrowDown") {
            dir = "down";
        } else if (e.key === "ArrowLeft") {
            dir = "left";
        } else if (e.key === "ArrowRight") {
            dir = "right";
        }

        if (!dir) {
            return;
        }

        e.preventDefault();
        handleAnswer(dir);
    });

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    updateHeader();
});
