/* ================================================
 *  Game Widgets — Comments & Inline Leaderboard
 *  Loaded after analytics.js in every game page
 * ================================================ */

/* ——— Prevent double-init ——— */
if (!window.__gameWidgetsLoaded) {
    window.__gameWidgetsLoaded = true;

(function () {
    "use strict";

    /* ===============================================
     *  1. COMMENTS WIDGET
     *  Injected at the bottom of the page body.
     * =============================================== */

    function initComments() {
        var container = document.getElementById("game-comments");
        if (!container) {
            container = document.createElement("div");
            container.id = "game-comments";
            document.body.appendChild(container);
        }

        container.innerHTML =
            '<div class="gw-comments">' +
                '<h3 class="gw-comments-title">💬 Коментарі</h3>' +
                '<div class="gw-comments-list" id="gw-comments-list">' +
                    '<p class="gw-empty">Завантаження...</p>' +
                '</div>' +
                '<div class="gw-comment-form">' +
                    '<textarea id="gw-comment-text" class="gw-textarea" placeholder="Напишіть коментар..." rows="2" maxlength="1000"></textarea>' +
                    '<button id="gw-comment-send" class="gw-btn">Надіслати</button>' +
                '</div>' +
            '</div>';

        loadComments();

        var sendBtn = document.getElementById("gw-comment-send");
        var textArea = document.getElementById("gw-comment-text");

        sendBtn.addEventListener("click", function () {
            var text = textArea.value.trim();
            if (!text) return;

            var name = GameAnalytics.getPlayerName();
            if (!name) {
                name = GameAnalytics.ensurePlayerName();
                if (!name) return;
            }

            sendBtn.disabled = true;
            sendBtn.textContent = "...";

            GameAnalytics.postComment(text, function (comment) {
                sendBtn.disabled = false;
                sendBtn.textContent = "Надіслати";
                if (comment) {
                    textArea.value = "";
                    prependComment(comment);
                } else {
                    alert("Не вдалося надіслати коментар. Спробуйте ще раз.");
                }
            });
        });

        textArea.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    }

    function loadComments() {
        GameAnalytics.fetchComments(function (comments) {
            var list = document.getElementById("gw-comments-list");
            if (!list) return;
            if (comments.length === 0) {
                list.innerHTML = '<p class="gw-empty">Поки що немає коментарів. Будьте першим!</p>';
                return;
            }
            list.innerHTML = "";
            comments.forEach(function (c) {
                appendComment(c, list);
            });
        });
    }

    function appendComment(c, list) {
        if (!list) list = document.getElementById("gw-comments-list");
        var emptyEl = list.querySelector(".gw-empty");
        if (emptyEl) emptyEl.remove();

        var initial = (c.player_name || "?").charAt(0).toUpperCase();
        var div = document.createElement("div");
        div.className = "gw-comment";
        div.innerHTML =
            '<div class="gw-comment-avatar">' + initial + '</div>' +
            '<div class="gw-comment-body">' +
                '<div class="gw-comment-header">' +
                    '<span class="gw-comment-name">' + escHtml(c.player_name) + '</span>' +
                    '<span class="gw-comment-time">' + escHtml(c.ago || c.created_at) + '</span>' +
                '</div>' +
                '<p class="gw-comment-text">' + escHtml(c.comment) + '</p>' +
            '</div>';
        list.appendChild(div);
    }

    function prependComment(c) {
        var list = document.getElementById("gw-comments-list");
        if (!list) return;
        var emptyEl = list.querySelector(".gw-empty");
        if (emptyEl) emptyEl.remove();

        var initial = (c.player_name || "?").charAt(0).toUpperCase();
        var div = document.createElement("div");
        div.className = "gw-comment gw-comment-new";
        div.innerHTML =
            '<div class="gw-comment-avatar">' + initial + '</div>' +
            '<div class="gw-comment-body">' +
                '<div class="gw-comment-header">' +
                    '<span class="gw-comment-name">' + escHtml(c.player_name) + '</span>' +
                    '<span class="gw-comment-time">щойно</span>' +
                '</div>' +
                '<p class="gw-comment-text">' + escHtml(c.comment) + '</p>' +
            '</div>';
        list.insertBefore(div, list.firstChild);
    }

    /* ===============================================
     *  2. INLINE LEADERBOARD
     *  Renders into #gw-leaderboard-inline inside
     *  the result-card of each game.
     * =============================================== */

    /**
     * Fetch leaderboard from API and render it inline
     * inside the element with id="gw-leaderboard-inline".
     */
    function renderLeaderboardInline() {
        var container = document.getElementById("gw-leaderboard-inline");
        if (!container) return;

        /* Show loading state */
        container.innerHTML =
            '<p class="gw-lb-loading">Завантаження рейтингу...</p>';

        GameAnalytics.fetchLeaderboard(function (resp) {
            var container = document.getElementById("gw-leaderboard-inline");
            if (!container) return;

            var board = resp.leaderboard || [];
            if (board.length === 0) {
                container.innerHTML =
                    '<p class="gw-lb-loading">Ще немає результатів</p>';
                return;
            }

            var playerName = GameAnalytics.getPlayerName() || "";
            var myRank = -1;

            /* Find current player's rank */
            for (var i = 0; i < board.length; i++) {
                if (board[i].player_name === playerName) {
                    myRank = i;
                    break;
                }
            }

            /* Build HTML — top 7 + current player if outside top 7 + last */
            var showTop = Math.min(7, board.length);
            var html =
                '<h3 class="gw-lb-inline-title">🏆 Рейтинг гравців</h3>' +
                '<div class="gw-lb-inline-rows">';

            for (var j = 0; j < showTop; j++) {
                html += renderRow(board[j], j, playerName);
            }

            /* If current player is beyond top 7 */
            if (myRank >= 7) {
                html += '<div class="gw-lb-sep">···</div>';
                html += renderRow(board[myRank], myRank, playerName);
            }

            /* Show the very last player if different */
            var lastIdx = board.length - 1;
            if (lastIdx > showTop - 1 && lastIdx !== myRank) {
                if (myRank < 7 || lastIdx > myRank) {
                    html += '<div class="gw-lb-sep">···</div>';
                    html += renderRow(board[lastIdx], lastIdx, playerName);
                }
            }

            html += '</div>';
            container.innerHTML = html;
        });
    }

    function renderRow(entry, index, currentPlayerName) {
        var medals = ["🥇", "🥈", "🥉"];
        var rank = index < 3 ? medals[index] : (index + 1) + ".";
        var isMe = entry.player_name === currentPlayerName;
        var cls = "gw-lb-irow" + (isMe ? " gw-lb-me" : "");

        return '<div class="' + cls + '">' +
            '<span class="gw-lb-irank">' + rank + '</span>' +
            '<span class="gw-lb-iname">' + escHtml(entry.player_name) + (isMe ? ' <small>(ви)</small>' : '') + '</span>' +
            '<span class="gw-lb-iscore">' + escHtml(entry.label || entry.score) + '</span>' +
        '</div>';
    }

    /* ——— Utility ——— */
    function escHtml(str) {
        if (!str && str !== 0) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /* ——— Auto-init when DOM ready ——— */
    function onReady(fn) {
        if (document.readyState !== "loading") { fn(); }
        else { document.addEventListener("DOMContentLoaded", fn); }
    }

    onReady(function () {
        initComments();
    });

    /* ——— Export to global ——— */
    window.GameWidgets = {
        renderLeaderboardInline: renderLeaderboardInline,
        reloadComments: loadComments
    };

})();
}
