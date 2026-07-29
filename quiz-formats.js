/*
 * quiz-formats.js — alternate render formats for the same backend MCQ data.
 *
 * Formats: flip cards, drag & drop (pointer + touch), true/false.
 *
 * Loaded AFTER app.js. Rather than editing app.js, this file replaces a few of
 * its global functions. That works because app.js is a classic script: its
 * top-level `function` declarations are writable properties on `window`, and
 * every call site (including the inline onclick="" strings it generates)
 * resolves the identifier at call time, so it picks up the replacement.
 *
 * The only thing app.js has to give us is `window.__quizBridge`, because its
 * `state` is a `const` and therefore not reachable from another file. If the
 * bridge is missing, everything degrades to the original classic view.
 */
(function () {
    'use strict';

    // ---------------------------------------------------------------- config

    // Last-resort format when neither the teacher's quiz-level setting nor a URL
    // override says otherwise. Keep this as 'classic': quizzes created before the
    // Question Format field existed have no saved setting, and must keep
    // rendering exactly as they always have.
    var QF_DEFAULT_FORMAT = 'classic';

    var MIXED_POOL = ['classic', 'flip', 'drag', 'truefalse'];

    var FORMAT_ALIASES = {
        dragdrop: 'drag',
        'drag-drop': 'drag',
        tf: 'truefalse',
        'true-false': 'truefalse',
        flipcards: 'flip',
        'flip-cards': 'flip'
    };

    var qfParams = new URLSearchParams(window.location.search);
    var qfUrlFormat = null; // resolved once the registry exists, at the bottom

    // Matches app.js:36 — a present, non-empty value enables reveal mode.
    var qfReveal = !!qfParams.get('showAnswersNoSubmit');

    // Set by the "Switch to classic view" toggle. Deliberately in memory rather
    // than in the URL: reloading mid-quiz would wipe all answers, since the
    // whole quiz lives in app.js's in-memory `state`.
    var qfSessionOverride = null;

    // ------------------------------------------------------------- utilities

    function qfEscape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Stable 32-bit hash. Every "random" choice here is derived from the
    // question index through this, so a question keeps the same format, the
    // same chip order and the same true/false statement across re-renders.
    function qfHash(n) {
        var h = (n + 0x9E3779B1) | 0;
        h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
        h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
        return (h ^ (h >>> 16)) >>> 0;
    }

    function qfLetter(position) {
        return String.fromCharCode(65 + position);
    }

    // ---------------------------------------------------------- app.js bridge

    function qfState() {
        var bridge = window.__quizBridge;
        return bridge ? bridge.state : null;
    }

    function qfRoundData() {
        var s = qfState();
        if (!s || !s.roundAnswers) return null;
        return s.roundAnswers[s.currentRound] || null;
    }

    function qfRawQuestion(index) {
        var rd = qfRoundData();
        return rd && rd.questions ? rd.questions[index] : null;
    }

    function qfContainer() {
        return document.getElementById('questions-container');
    }

    // ------------------------------------------------------------ normalizing

    var qfNormCache = new WeakMap();
    var QF_OPTION_KEY = /^option\s*(\d+)$/i;

    /*
     * Reads a raw Firestore question into a predictable shape.
     *
     * Options are discovered by scanning keys rather than counting to 4, so
     * `Option 1` / `option 1` / `Option1`, two options, six options and
     * non-contiguous numbering all work. `idx` keeps the number from the key,
     * because that is what `answers[i]` and generateReport() are keyed on —
     * the displayed A/B/C letter comes from array position instead.
     */
    function qfNormalize(rawQ) {
        if (!rawQ || typeof rawQ !== 'object') return null;
        if (qfNormCache.has(rawQ)) return qfNormCache.get(rawQ);

        var options = [];
        Object.keys(rawQ).forEach(function (key) {
            var match = QF_OPTION_KEY.exec(key);
            if (!match) return;

            var opt = rawQ[key];
            if (!opt || typeof opt !== 'object') return;

            var text = opt.optionText != null ? opt.optionText
                : opt.OptionText != null ? opt.OptionText
                    : opt.text != null ? opt.text : '';
            text = String(text).trim();
            if (!text) return; // an empty option is unusable as a card or a chip

            options.push({
                idx: parseInt(match[1], 10),
                text: text,
                // Strict `=== true`, matching generateReport() (app.js:919).
                // Being more lenient here than the scorer would mean showing a
                // different answer key than the one students are graded on.
                correct: opt.correct === true
            });
        });

        options.sort(function (a, b) { return a.idx - b.idx; });

        var correctOnes = options.filter(function (o) { return o.correct; });
        var text = String(rawQ.Question || rawQ.question || '').trim();

        var nq = {
            text: text,
            options: options,
            correctIndex: correctOnes.length ? correctOnes[0].idx : null,
            multiCorrect: correctOnes.length > 1,
            valid: !!text && options.length >= 2 && correctOnes.length > 0
        };

        qfNormCache.set(rawQ, nq);
        return nq;
    }

    /*
     * Replicates generateReport()'s answer-key lookup (app.js:917-923) exactly,
     * including its capitalised-only keys and its 1..4 ceiling.
     *
     * Do not "fix" this. It is deliberately bug-compatible with the scorer: any
     * format that maps an answer onto an option index must agree with how that
     * index will actually be graded, or students get marked against a different
     * key than the interface implied.
     */
    function qfScorerCorrectIndex(rawQ) {
        if (!rawQ) return null;
        for (var j = 1; j <= 4; j++) {
            var opt = rawQ['Option ' + j];
            if (opt && opt.correct === true) return j;
        }
        return null;
    }

    // ------------------------------------------------- per-round view state

    // Ephemeral per-question UI state: which cards are face-up, the cached chip
    // order, the cached true/false statement. Never touches `answers`, so it
    // never reaches the report or localStorage. Cleared when the round changes.
    var qfUiRound = null;
    var qfUi = {};
    var qfTfPlan = null;

    function qfUiFor(index) {
        var s = qfState();
        var round = s ? s.currentRound : 0;
        if (qfUiRound !== round) {
            qfUiRound = round;
            qfUi = {};
            qfTfPlan = null;
        }
        if (!qfUi[index]) {
            qfUi[index] = { flipped: {}, order: null, shown: null, picked: null };
        }
        return qfUi[index];
    }

    // ------------------------------------------------------- format registry

    var QF_RENDERERS = {};

    function qfCanonicalFormat(name) {
        if (!name) return null;
        var key = String(name).trim().toLowerCase();
        var resolved = FORMAT_ALIASES[key] || key;
        if (resolved === 'classic' || resolved === 'mixed') return resolved;
        return QF_RENDERERS[resolved] ? resolved : null;
    }

    /*
     * The teacher's choice, saved on the quiz document by quiz-format-setup.js.
     * This is the normal production source of truth.
     *
     * `renderType` / `renderMode` are accepted as aliases so quizzes written by
     * other tooling still resolve. Returns null when the quiz predates the
     * setting, which is what makes old quizzes fall through to classic.
     */
    function qfQuizFormat() {
        var s = qfState();
        var quiz = s ? s.activeQuiz : null;
        if (!quiz) return null;
        var field = window.qfQuizFormatField || 'questionFormat';
        return qfCanonicalFormat(quiz[field] || quiz.renderType || quiz.renderMode);
    }

    function qfResolveFormat(index) {
        var raw = qfRawQuestion(index);
        if (!raw) return 'classic';

        var want = qfSessionOverride                                  // student pressed "Classic view"
            || qfUrlFormat                                            // ?format= — development / QA override
            || qfQuizFormat()                                         // teacher's saved quiz-level choice
            || qfCanonicalFormat(raw.renderType || raw.RenderType)    // legacy per-question field
            || QF_DEFAULT_FORMAT;                                     // 'classic'

        if (want === 'mixed') {
            want = MIXED_POOL[index % MIXED_POOL.length];
        }
        if (want === 'classic') return 'classic';

        var renderer = QF_RENDERERS[want];
        if (!renderer) return 'classic';

        var nq = qfNormalize(raw);
        if (!nq || !nq.valid) return 'classic';
        if (!renderer.supports(nq, raw)) return 'classic';

        return want;
    }

    // ---------------------------------------------------------- shared shell

    function qfShell(index, renderer, nq, bodyHtml) {
        return ''
            + '<div class="question-card qf-card" data-qf-format="' + qfEscape(renderer.id) + '">'
            + '  <div class="qf-head">'
            + '    <span class="qf-badge"><i class="bi ' + renderer.icon + '"></i> '
            + qfEscape(renderer.label) + '</span>'
            + '    <button type="button" class="qf-link" data-action="classic">'
            + '      <i class="bi bi-list-ul"></i> Classic view</button>'
            + '  </div>'
            + '  <h5 class="qf-qnum">Question ' + (index + 1) + '</h5>'
            + '  <p class="qf-stem">' + qfEscape(nq.text) + '</p>'
            + '  <p class="qf-instruction"><i class="bi bi-info-circle"></i> '
            + qfEscape(renderer.instruction) + '</p>'
            + bodyHtml
            + '</div>';
    }

    // ------------------------------------------------------- renderer: flip

    QF_RENDERERS.flip = {
        id: 'flip',
        label: 'Flip Cards',
        icon: 'bi-layers-fill',
        instruction: 'Tap a card to reveal the option, then press "Choose this".',

        supports: function (nq) {
            // Beyond six, the grid stops being usable in the narrow open-book column.
            return nq.options.length >= 2 && nq.options.length <= 6;
        },

        body: function (index, nq, raw) {
            var ui = qfUiFor(index);
            var rd = qfRoundData();
            var answer = rd ? rd.answers[index] : undefined;
            var key = qfReveal ? qfScorerCorrectIndex(raw) : null;

            var cards = nq.options.map(function (opt, pos) {
                var isFlipped = qfReveal || !!ui.flipped[opt.idx];
                var isChosen = answer === opt.idx;
                var isKey = qfReveal && key === opt.idx;

                var classes = ['qf-flip'];
                if (isFlipped) classes.push('is-flipped');
                if (isChosen) classes.push('is-chosen');
                if (isKey) classes.push('is-key');

                var back = ''
                    + '<div class="qf-face qf-face-back">'
                    + '  <span class="qf-flip-text">' + qfEscape(opt.text) + '</span>';

                if (qfReveal) {
                    back += isKey
                        ? '  <span class="qf-key-tag"><i class="bi bi-check-circle-fill"></i> Correct answer</span>'
                        : '';
                } else {
                    back += ''
                        + '  <button type="button" class="qf-choose" data-action="pick" data-opt="' + opt.idx + '">'
                        + (isChosen
                            ? '<i class="bi bi-check-circle-fill"></i> Chosen'
                            : 'Choose this')
                        + '</button>'
                        + '  <button type="button" class="qf-flip-back" data-action="flip" data-opt="' + opt.idx + '"'
                        + '          aria-label="Turn card ' + qfLetter(pos) + ' back over">'
                        + '    <i class="bi bi-arrow-counterclockwise"></i></button>';
                }
                back += '</div>';

                return ''
                    + '<div class="' + classes.join(' ') + '">'
                    + '  <div class="qf-flip-inner">'
                    + '    <button type="button" class="qf-face qf-face-front" data-action="flip"'
                    + '            data-opt="' + opt.idx + '" aria-label="Reveal option ' + qfLetter(pos) + '">'
                    + '      <span class="option-marker">' + qfLetter(pos) + '</span>'
                    + '      <span class="qf-flip-hint">Tap to reveal</span>'
                    + '    </button>'
                    + back
                    + '  </div>'
                    + '</div>';
            }).join('');

            return '<div class="qf-grid qf-flip-grid">' + cards + '</div>';
        },

        action: function (act, el, index) {
            var opt = parseInt(el.getAttribute('data-opt'), 10);
            if (isNaN(opt)) return;

            if (act === 'flip') {
                var ui = qfUiFor(index);
                if (ui.flipped[opt]) delete ui.flipped[opt];
                else ui.flipped[opt] = true;
                qfRepaint(index);
            } else if (act === 'pick') {
                window.selectOption(index, opt);
            }
        },

        // Keyboard 1-9: reveal the card and select it in one step.
        selectByNumber: function (index, opt) {
            qfUiFor(index).flipped[opt] = true;
            window.selectOption(index, opt);
        }
    };

    // ------------------------------------------------------- renderer: drag

    QF_RENDERERS.drag = {
        id: 'drag',
        label: 'Drag & Drop',
        icon: 'bi-hand-index-thumb-fill',
        instruction: 'Drag the correct answer into the box — or tap it, then tap the box.',

        supports: function (nq) {
            return nq.options.length >= 2 && !nq.multiCorrect;
        },

        body: function (index, nq, raw) {
            var ui = qfUiFor(index);
            var rd = qfRoundData();
            var answer = rd ? rd.answers[index] : undefined;
            var placed = qfReveal ? qfScorerCorrectIndex(raw) : answer;

            // Cache the shuffle. Re-shuffling on every visit reads as a bug and
            // destroys the spatial memory students build up.
            if (!ui.order) {
                ui.order = nq.options.map(function (o) { return o.idx; });
                for (var i = ui.order.length - 1; i > 0; i--) {
                    var j = qfHash(index * 31 + i) % (i + 1);
                    var tmp = ui.order[i];
                    ui.order[i] = ui.order[j];
                    ui.order[j] = tmp;
                }
            }

            var byIdx = {};
            nq.options.forEach(function (o, pos) { byIdx[o.idx] = { opt: o, pos: pos }; });

            var zoneInner;
            if (placed != null && byIdx[placed]) {
                zoneInner = ''
                    + '<span class="qf-chip is-placed">'
                    + '  <span class="qf-chip-letter">' + qfLetter(byIdx[placed].pos) + '</span>'
                    + '  <span class="qf-chip-text">' + qfEscape(byIdx[placed].opt.text) + '</span>'
                    + (qfReveal ? ''
                        : '  <button type="button" class="qf-chip-x" data-action="unplace"'
                        + '          aria-label="Remove this answer">&times;</button>')
                    + '</span>';
            } else {
                zoneInner = '<span class="qf-drop-hint">'
                    + '<i class="bi bi-box-arrow-in-down"></i> Drop the correct answer here</span>';
            }

            var chips = ui.order.map(function (idx) {
                var entry = byIdx[idx];
                if (!entry) return '';
                if (placed === idx) return ''; // it is sitting in the drop zone
                var isPicked = ui.picked === idx;
                return ''
                    + '<button type="button" class="qf-chip' + (isPicked ? ' is-picked' : '') + '"'
                    + '        data-action="pick" data-drag data-opt="' + idx + '">'
                    + '  <span class="qf-chip-letter">' + qfLetter(entry.pos) + '</span>'
                    + '  <span class="qf-chip-text">' + qfEscape(entry.opt.text) + '</span>'
                    + '</button>';
            }).join('');

            var awaiting = ui.picked != null ? ' is-awaiting' : '';
            var filled = placed != null ? ' is-filled' : '';

            return ''
                + '<div class="qf-drop' + awaiting + filled + '" data-drop data-action="place"'
                + '     role="button" tabindex="0" aria-label="Answer drop zone">'
                + zoneInner
                + '</div>'
                + '<div class="qf-tray' + (qfReveal ? ' is-locked' : '') + '">' + chips + '</div>';
        },

        action: function (act, el, index) {
            var ui = qfUiFor(index);

            if (act === 'pick') {
                var opt = parseInt(el.getAttribute('data-opt'), 10);
                if (isNaN(opt)) return;
                ui.picked = (ui.picked === opt) ? null : opt;
                qfRepaint(index);
            } else if (act === 'place') {
                if (ui.picked == null) return;
                var chosen = ui.picked;
                ui.picked = null;
                window.selectOption(index, chosen);
            } else if (act === 'unplace') {
                qfClearAnswer(index);
            }
        },

        selectByNumber: function (index, opt) {
            qfUiFor(index).picked = null;
            window.selectOption(index, opt);
        }
    };

    // -------------------------------------------------- renderer: truefalse

    var QF_TF_WORDS = /^(true|false|yes|no)$/i;

    function qfTfIsNative(nq) {
        return nq.options.length === 2 && nq.options.every(function (o) {
            return QF_TF_WORDS.test(o.text);
        });
    }

    /*
     * Decides, per question, whether the statement is built from the correct
     * option (so the answer is TRUE) or from a distractor (so it is FALSE).
     *
     * This is planned across the whole round rather than drawn per question:
     * hashing each index independently gave an 8/10 split on a real 10-question
     * round, which is enough for a student to just press TRUE every time. Here
     * exactly half the round is TRUE by construction, shuffled deterministically
     * so the order still isn't learnable.
     */
    function qfTfShowKeyAt(index) {
        if (!qfTfPlan) {
            var rd = qfRoundData();
            var n = rd && rd.questions ? rd.questions.length : 0;
            var plan = [];
            for (var i = 0; i < n; i++) plan.push(i < Math.ceil(n / 2));
            for (var j = plan.length - 1; j > 0; j--) {
                var k = qfHash(j * 7919 + n * 104729) % (j + 1);
                var tmp = plan[j];
                plan[j] = plan[k];
                plan[k] = tmp;
            }
            qfTfPlan = plan;
        }
        return !!qfTfPlan[index];
    }

    // Which option the derived statement is built around. Cached on first render
    // so the statement never changes under the student.
    function qfTfShown(index, nq, key) {
        var ui = qfUiFor(index);
        if (ui.shown != null) return ui.shown;

        if (qfTfShowKeyAt(index)) {
            ui.shown = key;
        } else {
            var others = nq.options
                .map(function (o) { return o.idx; })
                .filter(function (i) { return i !== key; });
            ui.shown = others.length ? others[qfHash(index * 23 + 9) % others.length] : key;
        }
        return ui.shown;
    }

    /*
     * Maps a True/False press back onto a real option index, which is what lets
     * this format work without touching the scorer at all:
     *
     *   shown is key   + TRUE  -> key          -> graded correct
     *   shown is key   + FALSE -> a distractor -> graded wrong
     *   shown is wrong + TRUE  -> that wrong   -> graded wrong
     *   shown is wrong + FALSE -> key          -> graded correct
     *
     * The stored value can never coincide with `shown` on a FALSE press, so the
     * pressed button can always be recovered on re-render.
     */
    function qfTfValue(nq, key, shown, sayTrue) {
        if (sayTrue) return shown;
        if (shown !== key) return key;
        var distractor = nq.options.filter(function (o) { return o.idx !== key; })[0];
        return distractor ? distractor.idx : key;
    }

    QF_RENDERERS.truefalse = {
        id: 'truefalse',
        label: 'True or False',
        icon: 'bi-check2-square',
        instruction: 'Decide whether the statement is true or false.',

        supports: function (nq, raw) {
            if (qfTfIsNative(nq)) return true;
            // Derived mode has to agree with the scorer, so it needs a key the
            // scorer can actually see (capitalised "Option N", N <= 4).
            return qfScorerCorrectIndex(raw) !== null;
        },

        body: function (index, nq, raw) {
            var rd = qfRoundData();
            var answer = rd ? rd.answers[index] : undefined;

            if (qfTfIsNative(nq)) {
                var key = qfScorerCorrectIndex(raw);
                var buttons = nq.options.map(function (opt) {
                    var kind = /^(true|yes)$/i.test(opt.text) ? 'true' : 'false';
                    var active = answer === opt.idx;
                    var isKey = qfReveal && key === opt.idx;
                    return qfTfButton(kind, opt.text, active, isKey, opt.idx);
                }).join('');
                return '<div class="qf-tf-grid">' + buttons + '</div>';
            }

            var scorerKey = qfScorerCorrectIndex(raw);
            var shown = qfTfShown(index, nq, scorerKey);
            var shownOpt = nq.options.filter(function (o) { return o.idx === shown; })[0];
            if (!shownOpt) return '<div class="qf-empty">This question cannot be shown here.</div>';

            var trueValue = qfTfValue(nq, scorerKey, shown, true);
            var falseValue = qfTfValue(nq, scorerKey, shown, false);

            var pressedTrue = answer !== undefined && answer === shown;
            var pressedFalse = answer !== undefined && answer !== shown;
            var truthIsTrue = shown === scorerKey;

            return ''
                + '<div class="qf-tf-statement">'
                + '  <span class="qf-tf-lead">Is this the correct answer?</span>'
                + '  <span class="qf-tf-claim">' + qfEscape(shownOpt.text) + '</span>'
                + '</div>'
                + '<div class="qf-tf-grid">'
                + qfTfButton('true', 'True', pressedTrue, qfReveal && truthIsTrue, trueValue)
                + qfTfButton('false', 'False', pressedFalse, qfReveal && !truthIsTrue, falseValue)
                + '</div>';
        },

        action: function (act, el, index) {
            if (act !== 'tf') return;
            var value = parseInt(el.getAttribute('data-value'), 10);
            if (isNaN(value)) return;
            window.selectOption(index, value);
        },

        // Digits don't map onto a two-button format; T/F keys handle it instead.
        selectByNumber: null
    };

    function qfTfButton(kind, label, active, isKey, value) {
        var classes = ['qf-tf-btn', 'is-' + kind];
        if (active) classes.push('is-active');
        if (isKey) classes.push('is-key');
        return ''
            + '<button type="button" class="' + classes.join(' ') + '"'
            + '        data-action="tf" data-value="' + value + '">'
            + '  <i class="bi ' + (kind === 'true' ? 'bi-hand-thumbs-up' : 'bi-hand-thumbs-down') + '"></i>'
            + '  <span>' + qfEscape(label) + '</span>'
            + '</button>';
    }

    // --------------------------------------------------------- answer helpers

    // app.js has no "clear an answer" path, so this does what selectOption()
    // does in reverse, then re-runs the same bookkeeping.
    function qfClearAnswer(index) {
        var rd = qfRoundData();
        if (!rd || rd.answers[index] === undefined) return;
        delete rd.answers[index];
        if (typeof window.updateProgress === 'function') window.updateProgress();
        qfSyncPills();
        qfRepaint(index);
    }

    function qfSyncPills() {
        var rd = qfRoundData();
        if (!rd) return;
        var pills = document.querySelectorAll('.question-number');
        Array.prototype.forEach.call(pills, function (el, i) {
            el.classList.toggle('answered', rd.answers[i] !== undefined);
        });
    }

    // ------------------------------------------------------------ dispatcher

    var qfOriginalNavigate = window.navigateToQuestion;
    var qfCurrentIndex = 0;
    var qfCurrentFormat = 'classic';

    function qfRenderFormat(index, formatId) {
        var renderer = QF_RENDERERS[formatId];
        var container = qfContainer();
        if (!renderer || !container) return;

        var raw = qfRawQuestion(index);
        var nq = qfNormalize(raw);
        if (!nq) return;

        // Build the whole string first so a throw mid-render can never leave
        // half-written markup on screen.
        var html = qfShell(index, renderer, nq, renderer.body(index, nq, raw));
        container.innerHTML = html;
    }

    function qfRepaint(index) {
        if (qfCurrentFormat !== 'classic') qfRenderFormat(index, qfCurrentFormat);
    }

    window.navigateToQuestion = function (index) {
        // Run the original first: it owns `currentQuestionIndex` (a script-scoped
        // `let` we cannot reach), updateProgress(), and the nav-pill classes.
        qfOriginalNavigate(index);

        try {
            var rd = qfRoundData();
            if (!rd || !rd.questions) return;
            if (index < 0 || index >= rd.questions.length) return;

            qfCurrentIndex = index;
            qfCurrentFormat = qfResolveFormat(index);
            if (qfCurrentFormat !== 'classic') qfRenderFormat(index, qfCurrentFormat);
            qfPostRender(index);
        } catch (err) {
            // A bug in here must never take the quiz down — the classic view
            // painted by the original call is still on screen.
            console.error('[quiz-formats] render failed; falling back to classic view', err);
        }
    };

    function qfPostRender(index) {
        var rd = qfRoundData();
        var total = rd && rd.questions ? rd.questions.length : 0;

        var prev = document.getElementById('prev-btn');
        var next = document.getElementById('next-btn');
        if (prev) prev.disabled = index <= 0;
        if (next) next.disabled = index >= total - 1;

        var active = document.querySelector('.question-number.active');
        if (active && active.scrollIntoView) {
            active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }

        qfUpdateNavButtons();

        if (qfSessionOverride === 'classic') qfAppendRestoreBar();
    }

    function qfAppendRestoreBar() {
        var container = qfContainer();
        if (!container || container.querySelector('.qf-restore')) return;
        var bar = document.createElement('div');
        bar.className = 'qf-restore';
        bar.innerHTML = '<button type="button" class="qf-link" data-action="activity">'
            + '<i class="bi bi-arrow-repeat"></i> Back to activity view</button>';
        container.appendChild(bar);
    }

    // ------------------------------------------------------ nav strip arrows

    /*
     * app.js:774 calls updateNavButtons() but never defines it, so every click
     * on the nav-strip arrows currently throws a ReferenceError after scrolling.
     * Defining it here removes the error and gives it its intended job — including
     * activating the .scrollable fade at style.css:206, which has never fired.
     */
    function qfUpdateNavButtons() {
        var nav = document.querySelector('.question-navigation');
        var wrap = document.querySelector('.questions-nav-container');
        if (!nav || !wrap) return;

        var max = nav.scrollWidth - nav.clientWidth;
        var atStart = nav.scrollLeft <= 1;
        var atEnd = nav.scrollLeft >= max - 1;

        var prev = wrap.querySelector('.nav-btn.prev-btn');
        var next = wrap.querySelector('.nav-btn.next-btn');
        if (prev) prev.disabled = max <= 1 || atStart;
        if (next) next.disabled = max <= 1 || atEnd;

        wrap.classList.toggle('scrollable', max > 1 && !atEnd);
    }

    window.updateNavButtons = qfUpdateNavButtons;

    // ------------------------------------------------------------ drag layer

    var qfDrag = null;
    var qfSuppressClick = false;
    var qfScrollTimer = null;

    function qfScroller() {
        var container = qfContainer();
        return container ? container.closest('.overflow-auto') : null;
    }

    function qfBeginDrag(e, src) {
        var rect = src.getBoundingClientRect();
        var ghost = src.cloneNode(true);
        ghost.classList.add('qf-ghost');
        ghost.classList.remove('is-picked');
        ghost.style.width = rect.width + 'px';
        ghost.style.left = '0';
        ghost.style.top = '0';
        document.body.appendChild(ghost);

        qfDrag.ghost = ghost;
        qfDrag.offsetX = e.clientX - rect.left;
        qfDrag.offsetY = e.clientY - rect.top;
        src.classList.add('is-dragging');
        qfMoveGhost(e.clientX, e.clientY);
    }

    function qfMoveGhost(x, y) {
        if (!qfDrag || !qfDrag.ghost) return;
        qfDrag.ghost.style.transform =
            'translate3d(' + (x - qfDrag.offsetX) + 'px,' + (y - qfDrag.offsetY) + 'px,0)';
    }

    function qfHitTest(x, y) {
        var el = document.elementFromPoint(x, y);
        return el ? el.closest('[data-drop]') : null;
    }

    function qfHighlight(target) {
        var zones = document.querySelectorAll('[data-drop]');
        Array.prototype.forEach.call(zones, function (z) {
            z.classList.toggle('is-hover', z === target);
        });
    }

    // Under the calc(100vh - 100px) layout the panel can overflow, and without
    // this a student simply cannot reach a drop zone that is off-screen.
    function qfEdgeScroll(y) {
        var scroller = qfScroller();
        if (!scroller) return;
        var rect = scroller.getBoundingClientRect();
        var zone = 40;
        var delta = 0;
        if (y < rect.top + zone) delta = -8;
        else if (y > rect.bottom - zone) delta = 8;

        if (delta === 0) {
            if (qfScrollTimer) { cancelAnimationFrame(qfScrollTimer); qfScrollTimer = null; }
            return;
        }
        if (qfScrollTimer) return;

        var step = function () {
            if (!qfDrag) { qfScrollTimer = null; return; }
            scroller.scrollTop += delta;
            qfScrollTimer = requestAnimationFrame(step);
        };
        qfScrollTimer = requestAnimationFrame(step);
    }

    function qfEndDrag(commit, e) {
        if (qfScrollTimer) { cancelAnimationFrame(qfScrollTimer); qfScrollTimer = null; }
        if (!qfDrag) return;

        var src = qfDrag.src;
        var moved = qfDrag.moved;

        if (qfDrag.ghost && qfDrag.ghost.parentNode) qfDrag.ghost.parentNode.removeChild(qfDrag.ghost);
        src.classList.remove('is-dragging');
        qfHighlight(null);

        var target = (commit && moved && e) ? qfHitTest(e.clientX, e.clientY) : null;
        qfDrag = null;

        if (moved) {
            // A completed drag must not also fire the tap-to-select click.
            qfSuppressClick = true;
            setTimeout(function () { qfSuppressClick = false; }, 0);
        }

        if (target) {
            var opt = parseInt(src.getAttribute('data-opt'), 10);
            if (!isNaN(opt)) {
                qfUiFor(qfCurrentIndex).picked = null;
                window.selectOption(qfCurrentIndex, opt);
            }
        }
    }

    function qfInitDragLayer(container) {
        container.addEventListener('pointerdown', function (e) {
            if (qfReveal || e.button !== 0) return;
            var src = e.target.closest('[data-drag]');
            if (!src) return;

            qfDrag = {
                id: e.pointerId, src: src,
                x0: e.clientX, y0: e.clientY,
                moved: false, ghost: null, offsetX: 0, offsetY: 0
            };
            try { src.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
        });

        // On window rather than the container: if setPointerCapture is refused,
        // the pointer can leave the container entirely mid-gesture.
        window.addEventListener('pointermove', function (e) {
            if (!qfDrag || e.pointerId !== qfDrag.id) return;

            if (!qfDrag.moved) {
                var dx = e.clientX - qfDrag.x0;
                var dy = e.clientY - qfDrag.y0;
                if (dx * dx + dy * dy < 36) return; // 6px — below this it is a tap
                qfDrag.moved = true;
                qfBeginDrag(e, qfDrag.src);
            }

            e.preventDefault();
            qfMoveGhost(e.clientX, e.clientY);
            qfHighlight(qfHitTest(e.clientX, e.clientY));
            qfEdgeScroll(e.clientY);
        }, { passive: false });

        window.addEventListener('pointerup', function (e) {
            if (!qfDrag || e.pointerId !== qfDrag.id) return;
            qfEndDrag(true, e);
        });

        // Fires when the browser steals the gesture. Must clean up, or the ghost
        // is left stranded on screen.
        window.addEventListener('pointercancel', function (e) {
            if (!qfDrag || e.pointerId !== qfDrag.id) return;
            qfEndDrag(false, e);
        });
    }

    // -------------------------------------------------------------- wiring

    function qfInitEvents() {
        var container = qfContainer();
        if (!container) return;

        container.addEventListener('click', function (e) {
            var el = e.target.closest('[data-action]');
            if (!el || !container.contains(el)) return;

            if (qfSuppressClick) { qfSuppressClick = false; return; }

            var act = el.getAttribute('data-action');

            if (act === 'classic') {
                qfSessionOverride = 'classic';
                window.navigateToQuestion(qfCurrentIndex);
                return;
            }
            if (act === 'activity') {
                qfSessionOverride = null;
                window.navigateToQuestion(qfCurrentIndex);
                return;
            }

            if (qfReveal) return; // reveal mode is an answer key, not an input

            var renderer = QF_RENDERERS[qfCurrentFormat];
            if (renderer && renderer.action) renderer.action(act, el, qfCurrentIndex);
        });

        // Real <button>s fire click from the keyboard already; the drop zone is a
        // div with role="button", so it needs this.
        container.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
            var el = e.target.closest('[data-action]');
            if (!el || el.tagName === 'BUTTON') return;
            e.preventDefault();
            el.click();
        });

        var nav = document.querySelector('.question-navigation');
        if (nav) nav.addEventListener('scroll', qfUpdateNavButtons, { passive: true });

        window.addEventListener('resize', qfUpdateNavButtons);

        qfInitDragLayer(container);
        qfInitKeyboard();
    }

    function qfInitKeyboard() {
        document.addEventListener('keydown', function (e) {
            var s = qfState();
            if (!s || !s.quizInProgress) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (document.querySelector('.modal.show')) return;

            // The target can be `document` itself, which has no .matches().
            var t = e.target;
            if (t && typeof t.matches === 'function'
                && (t.matches('input, textarea, select') || t.isContentEditable)) return;

            var quiz = document.getElementById('quiz-interface');
            if (!quiz || quiz.classList.contains('d-none')) return;

            var rd = qfRoundData();
            if (!rd || !rd.questions) return;

            if (e.key === 'ArrowLeft') {
                if (qfCurrentIndex > 0) { e.preventDefault(); window.navigateToQuestion(qfCurrentIndex - 1); }
                return;
            }
            if (e.key === 'ArrowRight') {
                if (qfCurrentIndex < rd.questions.length - 1) {
                    e.preventDefault();
                    window.navigateToQuestion(qfCurrentIndex + 1);
                }
                return;
            }
            if (e.key === 'Escape') {
                var ui = qfUiFor(qfCurrentIndex);
                if (ui.picked != null) { ui.picked = null; qfRepaint(qfCurrentIndex); }
                return;
            }

            if (qfReveal) return;

            var nq = qfNormalize(qfRawQuestion(qfCurrentIndex));
            if (!nq) return;

            if (qfCurrentFormat === 'truefalse' && /^[tfyn]$/i.test(e.key)) {
                var wantTrue = /^[ty]$/i.test(e.key);
                var btn = document.querySelector('.qf-tf-btn.is-' + (wantTrue ? 'true' : 'false'));
                if (btn) { e.preventDefault(); btn.click(); }
                return;
            }

            if (/^[1-9]$/.test(e.key)) {
                var pos = parseInt(e.key, 10) - 1;
                var opt = nq.options[pos];
                if (!opt) return;
                e.preventDefault();

                var renderer = QF_RENDERERS[qfCurrentFormat];
                if (renderer && renderer.selectByNumber) renderer.selectByNumber(qfCurrentIndex, opt.idx);
                else if (renderer && renderer.selectByNumber === null) return; // opted out
                else window.selectOption(qfCurrentIndex, opt.idx);
            }
        });
    }

    // ---------------------------------------------------------------- boot

    qfUrlFormat = qfCanonicalFormat(qfParams.get('format'));

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', qfInitEvents);
    } else {
        qfInitEvents();
    }

    if (!window.__quizBridge) {
        console.warn('[quiz-formats] window.__quizBridge is missing — alternate formats '
            + 'are disabled and the quiz will use the classic view.');
    }
})();
