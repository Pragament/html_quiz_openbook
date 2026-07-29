/*
 * quiz-format-setup.js — teacher-side configuration for question rendering.
 *
 * Adds a "Question Format" dropdown to the Create Quiz form and exposes the
 * selected value so app.js can persist it on the quiz document.
 *
 * The field is injected rather than written into the markup so that index.html
 * and embed.html both pick it up with no HTML edits — both carry their own copy
 * of #createQuizModal, and keeping them untouched avoids merge conflicts with
 * anyone else working on that modal.
 *
 * Student-side rendering lives in quiz-formats.js; this file only deals with
 * authoring. Load order between the two does not matter.
 */
(function () {
    'use strict';

    // The field name written to the quiz document. camelCase to match the
    // existing quiz schema (numQuestions, randomQuestions, timeLimitEnabled).
    var QF_QUIZ_FIELD = 'questionFormat';

    var SELECT_ID = 'quiz-question-format';

    // Order matches the teacher-facing list. `value` must match the renderer ids
    // in quiz-formats.js, plus 'mixed'.
    var QF_CHOICES = [
        { value: 'classic', label: 'Classic MCQ' },
        { value: 'mixed', label: 'Random / Mixed' },
        { value: 'flip', label: 'Flip Cards' },
        { value: 'drag', label: 'Drag & Drop' },
        { value: 'truefalse', label: 'True / False' }
    ];

    // Pre-selected option. 'classic' keeps a newly created quiz behaving exactly
    // like every existing one unless the teacher deliberately picks otherwise.
    var QF_CHOICE_DEFAULT = 'classic';

    function qfIsValidChoice(value) {
        for (var i = 0; i < QF_CHOICES.length; i++) {
            if (QF_CHOICES[i].value === value) return true;
        }
        return false;
    }

    function qfBuildField() {
        var wrap = document.createElement('div');
        wrap.className = 'mb-3';

        var label = document.createElement('label');
        label.className = 'form-label';
        label.setAttribute('for', SELECT_ID);
        label.textContent = 'Question Format';

        var select = document.createElement('select');
        select.className = 'form-select';
        select.id = SELECT_ID;

        QF_CHOICES.forEach(function (choice) {
            var opt = document.createElement('option');
            opt.value = choice.value;
            opt.textContent = choice.label;
            if (choice.value === QF_CHOICE_DEFAULT) {
                // Set the attribute, not just the property: app.js calls
                // form.reset() after saving, which restores the *default*
                // selected option rather than the current one.
                opt.setAttribute('selected', 'selected');
            }
            select.appendChild(opt);
        });

        var help = document.createElement('small');
        help.className = 'text-muted';
        help.textContent = 'How questions are shown to students. '
            + 'Random / Mixed varies the style between questions in the same quiz.';

        wrap.appendChild(label);
        wrap.appendChild(select);
        wrap.appendChild(help);
        return wrap;
    }

    function qfInjectField() {
        var form = document.getElementById('quiz-form');
        if (!form) return false;                                 // page has no create-quiz form
        if (document.getElementById(SELECT_ID)) return true;     // already injected

        var field = qfBuildField();

        /*
         * Sit directly below "Number of Questions", grouping this with the other
         * question settings. Placing it last instead put it ~594px down the form,
         * below the fold on a laptop, where teachers simply did not see it.
         *
         * Two fallbacks, so a reshuffle of the modal can't drop the field: above
         * the per-round config, else appended to the form.
         */
        var numQuestions = document.getElementById('num-questions');
        var afterEl = numQuestions ? numQuestions.closest('.mb-3') : null;

        if (afterEl && afterEl.parentNode === form) {
            form.insertBefore(field, afterEl.nextSibling);
        } else {
            var roundsCfg = document.getElementById('rounds-config');
            if (roundsCfg && roundsCfg.parentNode === form) form.insertBefore(field, roundsCfg);
            else form.appendChild(field);
        }

        return true;
    }

    /*
     * Read by app.js when building quizData. Returns a value that is always one
     * of QF_CHOICES, so a missing or tampered-with select can never write junk
     * to the quiz document.
     */
    window.qfGetSelectedQuizFormat = function () {
        var el = document.getElementById(SELECT_ID);
        var value = el ? String(el.value || '').trim().toLowerCase() : '';
        return qfIsValidChoice(value) ? value : QF_CHOICE_DEFAULT;
    };

    // Exposed so quiz-formats.js and any future admin tooling agree on the field
    // name without hard-coding it in two places.
    window.qfQuizFormatField = QF_QUIZ_FIELD;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', qfInjectField);
    } else {
        qfInjectField();
    }
})();
