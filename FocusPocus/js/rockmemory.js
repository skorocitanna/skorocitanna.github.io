document.addEventListener("DOMContentLoaded", function () {
    // ===== Елементи DOM =====
    var timeEl = document.getElementById("time");
    var scoreEl = document.getElementById("score");
    var livesEl = document.getElementById("lives");
    var stopResumeBtn = document.getElementById("btn-stop-resume");

    var iconsField = document.getElementById("icons-field");
    var curtain = document.getElementById("curtain");
    var stageEl = document.getElementById("stage");

    // Розмір іконки (має відповідати CSS)
    var ICON_SIZE = 56;
    var ICON_SIZE_MOBILE = 48;
    var PADDING = 10;

    var startScreenEl = document.getElementById("start-screen");
    var startBtn = document.getElementById("start-btn");
    var countdownEl = document.getElementById("countdown");

    var resultEl = document.getElementById("result");
    var correctEl = document.getElementById("correct");
    var totalEl = document.getElementById("total");
    var bestListEl = document.getElementById("best-list");
    var playAgainBtn = document.getElementById("play-again");

    // ===== SVG іконки (1..36) =====
    var TOTAL_SVGS = 36;
    var allSvgs = [];
    for (var i = 1; i <= TOTAL_SVGS; i++) {
        allSvgs.push(i);
    }

    // ===== Попереднє завантаження всіх SVG =====
    (function preloadAllSvgs() {
        for (var i = 1; i <= TOTAL_SVGS; i++) {
            var img = new Image();
            img.src = "./svgs/" + i + ".svg";
        }
    })();

    // ===== Стан гри =====
    var state = {
        time: 180,
        lives: 5,
        total: 0,
        correct: 0,
        timerId: null,
        running: false,
        // Масив SVG id які зараз на полі
        currentIcons: [],
        // SVG id нової іконки (правильна відповідь)
        newIconId: null,
        // Масив SVG id які ще не використані
        availablePool: [],
        // Чи можна клікати
        canClick: false,
        // Чи завіса анімується
        animating: false,
        // Позиції іконок {svgId: {x, y}}
        iconPositions: {}
    };

    var audioContext = null;
    var isPaused = false;

    // ===== Утиліти =====
    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
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
        if (!audioContext) return;
        var osc = audioContext.createOscillator();
        var gain = audioContext.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.12);
    }

    // ===== Оновлення UI =====
    function updateHeader() {
        timeEl.textContent = state.time;
        scoreEl.textContent = state.correct;
        livesEl.textContent = "❤️".repeat(state.lives);
    }

    // ===== Завіса =====
    function closeCurtain(callback) {
        state.animating = true;
        state.canClick = false;
        stopTimer();
        curtain.classList.remove("open");
        curtain.classList.add("closed");
        // Завіса закривається за 0.7s (CSS transition), чекаємо 750ms
        // Потім рендеримо іконки, потім ще 500ms пауза закритою перед відкриттям
        setTimeout(function () {
            if (callback) callback();
        }, 1750);
    }

    function openCurtain(callback) {
        state.animating = true;
        state.canClick = false;
        stopTimer();
        curtain.classList.remove("closed");
        curtain.classList.add("open");
        setTimeout(function () {
            state.animating = false;
            state.canClick = true;
            if (state.running && !isPaused) {
                startTimer();
            }
            if (callback) callback();
        }, 700);
    }

    // ===== Розмір іконки залежно від екрану =====
    function getIconSize() {
        return window.innerWidth <= 640 ? ICON_SIZE_MOBILE : ICON_SIZE;
    }

    // ===== Рандомні позиції без перекриття =====
    function generateNewPosition(existingPositions) {
        var size = getIconSize();
        var w = stageEl.clientWidth;
        var h = stageEl.clientHeight;
        var maxAttempts = 200;

        for (var attempt = 0; attempt < maxAttempts; attempt++) {
            var x = PADDING + Math.random() * (w - size - PADDING * 2);
            var y = PADDING + Math.random() * (h - size - PADDING * 2);
            var overlap = false;

            for (var j = 0; j < existingPositions.length; j++) {
                var dx = x - existingPositions[j].x;
                var dy = y - existingPositions[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < size + 6) {
                    overlap = true;
                    break;
                }
            }

            if (!overlap) {
                return { x: x, y: y };
            }
        }
        // Якщо не вдалося — розмістити де є
        return {
            x: PADDING + Math.random() * (w - size - PADDING * 2),
            y: PADDING + Math.random() * (h - size - PADDING * 2)
        };
    }

    // ===== Рендер іконок =====
    function renderIcons() {
        iconsField.innerHTML = "";

        // Для нової іконки генеруємо нову позицію
        if (state.newIconId && !state.iconPositions[state.newIconId]) {
            var existingPositions = [];
            for (var id in state.iconPositions) {
                existingPositions.push(state.iconPositions[id]);
            }
            state.iconPositions[state.newIconId] = generateNewPosition(existingPositions);
        }

        // Рендеримо всі іконки
        state.currentIcons.forEach(function (svgId) {
            var div = document.createElement("div");
            div.className = "icon-item";
            if (svgId === state.newIconId) {
                div.classList.add("new-icon");
            }
            div.dataset.svgId = svgId;

            var pos = state.iconPositions[svgId];
            div.style.left = pos.x + "px";
            div.style.top = pos.y + "px";

            var img = document.createElement("img");
            img.src = "./svgs/" + svgId + ".svg";
            img.alt = "icon " + svgId;
            img.draggable = false;

            div.appendChild(img);
            iconsField.appendChild(div);
        });
    }

    // ===== Обробка кліку на іконку =====
    function handleIconClick(e) {
        if (!state.running || !state.canClick || state.animating) return;

        var target = e.target.closest(".icon-item");
        if (!target) return;

        var clickedId = parseInt(target.dataset.svgId, 10);
        state.total += 1;

        if (clickedId === state.newIconId) {
            // Правильно!
            state.correct += 1;
            target.classList.add("correct-flash");
            updateHeader();
            setTimeout(function () {
                nextRound();
            }, 350);
        } else {
            // Помилка
            state.lives -= 1;
            target.classList.add("wrong-flash");
            updateHeader();

            if (state.lives <= 0) {
                setTimeout(function () {
                    endGame();
                }, 400);
                return;
            }

            // Підсвітити правильну іконку
            var allItems = iconsField.querySelectorAll(".icon-item");
            allItems.forEach(function (item) {
                if (parseInt(item.dataset.svgId, 10) === state.newIconId) {
                    item.classList.add("correct-flash");
                }
            });

            setTimeout(function () {
                nextRound();
            }, 600);
        }
    }

    // ===== Наступний раунд =====
    function nextRound() {
        if (!state.running) return;

        // Закрити завісу, потім підготувати іконки поки вона закрита, потім відкрити
        closeCurtain(function () {
            // Тут завіса вже повністю закрита — додаємо нову іконку
            if (state.availablePool.length === 0) {
                var usedSet = {};
                state.currentIcons.forEach(function (id) {
                    usedSet[id] = true;
                });
                state.availablePool = allSvgs.filter(function (id) {
                    return !usedSet[id];
                });
                state.availablePool = shuffle(state.availablePool);

                if (state.availablePool.length === 0) {
                    state.availablePool = shuffle(allSvgs.slice());
                }
            }

            var newId = state.availablePool.pop();
            state.newIconId = newId;
            state.currentIcons.push(newId);

            // Рендеримо поки завіса закрита — іконки зʼявляються без анімації
            renderIcons();

            // Затримка щоб браузер встиг намалювати DOM перед відкриттям
            // Використовуємо requestAnimationFrame + setTimeout для гарантії
            requestAnimationFrame(function () {
                setTimeout(function () {
                    openCurtain();
                }, 150);
            });
        });
    }

    // ===== Перший раунд (тільки 1 іконка) =====
    function firstRound() {
        state.availablePool = shuffle(allSvgs.slice());
        state.currentIcons = [];

        var firstId = state.availablePool.pop();
        state.newIconId = firstId;
        state.currentIcons.push(firstId);

        renderIcons();

        // Відкрити завісу
        openCurtain();
    }

    // ===== Таймер =====
    function tick() {
        if (!state.running || !state.canClick || state.animating) return;
        state.time -= 1;
        updateHeader();
        if (state.time <= 0) {
            endGame();
        }
    }

    function stopTimer() {
        clearInterval(state.timerId);
        state.timerId = null;
    }

    function startTimer() {
        stopTimer();
        state.timerId = setInterval(tick, 1000);
    }

    // ===== Зворотній відлік =====
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
            firstRound();
        }, 1000);
    }

    // ===== Зберегти / показати результати =====
    function saveResult() {
        var entry = {
            correct: state.correct,
            total: state.total,
            player: GameAnalytics.getPlayerName(),
            date: new Date().toISOString().slice(0, 10)
        };
        var stored = JSON.parse(localStorage.getItem("rockMemoryResults") || "[]");
        stored.push(entry);
        localStorage.setItem("rockMemoryResults", JSON.stringify(stored));
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
                "<span>" + (index + 1) + ". " + (item.player || "—") + " — " + item.correct + " / " + item.total + "</span>" +
                "<span>" + item.date + "</span>";
            bestListEl.appendChild(li);
        });
    }

    // ===== Завершення гри =====
    function endGame() {
        state.running = false;
        state.canClick = false;
        clearInterval(state.timerId);

        correctEl.textContent = state.correct;
        totalEl.textContent = state.total;

        var results = saveResult();
        renderBest(results);
        resultEl.classList.add("visible");
        GameAnalytics.send("game_end", { correct: state.correct, total: state.total });
        setTimeout(function () { GameWidgets.renderLeaderboardInline(); }, 500);
    }

    // ===== Скидання гри =====
    function resetGame(toStartScreen) {
        clearInterval(state.timerId);
        state.time = 180;
        state.lives = 5;
        state.total = 0;
        state.correct = 0;
        state.currentIcons = [];
        state.newIconId = null;
        state.availablePool = [];
        state.running = false;
        state.canClick = false;
        state.animating = false;
        state.iconPositions = {};
        isPaused = false;

        updateHeader();
        resultEl.classList.remove("visible");
        iconsField.innerHTML = "";

        // Завісу закрити
        curtain.classList.remove("open");
        curtain.classList.add("closed");

        stopResumeBtn.textContent = "Зупинити";

        if (toStartScreen) {
            startScreenEl.style.display = "flex";
            stopResumeBtn.style.display = "none";
            countdownEl.classList.add("hidden");
        } else {
            showCountdown();
        }
    }

    // ===== Обробники подій =====
    iconsField.addEventListener("click", handleIconClick);

    stopResumeBtn.addEventListener("click", function () {
        if (!state.running && !isPaused) return;

        if (isPaused) {
            stopResumeBtn.textContent = "Зупинити";
            state.running = true;
            state.canClick = true;
            startTimer();
        } else {
            stopResumeBtn.textContent = "Продовжити";
            state.running = false;
            state.canClick = false;
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

    playAgainBtn.addEventListener("click", function () {
        resetGame(true);
    });

    // ===== Ініціалізація =====
    curtain.classList.add("closed");
    updateHeader();
});
