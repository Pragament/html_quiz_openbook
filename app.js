// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFpwi3k7Qth9MiqqRGKstY0Zkj_vrcdFY",
    authDomain: "edutrack-admin.firebaseapp.com",
    projectId: "edutrack-admin",
    storageBucket: "edutrack-admin.firebasestorage.app",
    messagingSenderId: "193864081571",
    appId: "1:193864081571:web:7501afde01291f81e61f16"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Application State
let appState = {
    currentView: 'paper-selection', // 'paper-selection' or 'quiz'
    selectedPaperId: null,
    allPapers: [] // Store fetched papers for local filtering
};

// Quiz State
let quizState = {
    currentQuestion: 0,
    answers: {},
    startTime: null,
    timeElapsed: 0,
    totalQuestions: 0,
    questions: [],
    pdfDocument: null,
    currentPdfPage: 1,
    pdfScale: 1.2, // Adjusted for split screen
    timerInterval: null,
    renderTask: null // Track PDF render task
};

// DOM Elements
const elements = {
    // Views
    paperSelectionView: document.getElementById('paper-selection'),
    quizInterfaceView: document.getElementById('quiz-interface'),
    papersList: document.getElementById('papers-list'),
    paperSearch: document.getElementById('paper-search'),

    // Quiz Elements
    questionsContainer: document.getElementById('questions-container'),
    questionNav: document.getElementById('question-nav'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    submitBtn: document.getElementById('submit-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    timer: document.getElementById('timer'),

    // PDF Elements
    pdfCanvas: document.getElementById('pdf-canvas'),
    pageNum: document.getElementById('page-num'),
    pageCount: document.getElementById('page-count'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pdfSearch: document.getElementById('pdf-search'),

    // Navigation
    backToListBtn: document.getElementById('back-to-list'),
    mobileBackBtn: document.getElementById('mobile-back')
};

// --- Initialization ---

async function initApp() {
    await fetchPapers();
}

async function fetchPapers() {
    // console.log('Fetching papers...');
    elements.papersList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-primary"></div><p class="mt-2">Connecting to Firebase...</p></div>';

    try {
        const [snapshotLower, snapshotUpper] = await Promise.all([
            db.collection('questionpapers').get().catch(e => { console.warn("Access to 'questionpapers' failed", e); return { empty: true, docs: [] }; }),
            db.collection('QuestionPapers').get().catch(e => { console.warn("Access to 'QuestionPapers' failed", e); return { empty: true, docs: [] }; })
        ]);

        const uniquePapersMap = new Map();

        const processDoc = (doc, collectionName) => {
            if (uniquePapersMap.has(doc.id)) return;

            const data = doc.data();
            // Normalize data for display and search
            const title = data.Title || data.title || data.Name || data.name ||
                data.Subject || data.subject || data.testName ||
                data.heading || data.Heading ||
                `Paper ${doc.id.substring(0, 6)}`;

            const classInfo = data.Class || data.class || data.Grade || data.grade || data.standard;
            const subtitle = classInfo ? `Class: ${classInfo}` : (data.Description || data.description || 'Open Book Assessment');

            const questions = data.questions || data.Questions || [];
            const questionCount = questions.length;

            uniquePapersMap.set(doc.id, {
                id: doc.id,
                collectionName,
                title,
                subtitle,
                questionCount,
                rawData: data
            });
        };

        snapshotLower.docs.forEach(d => processDoc(d, 'questionpapers'));
        snapshotUpper.docs.forEach(d => processDoc(d, 'QuestionPapers'));

        appState.allPapers = Array.from(uniquePapersMap.values());

        if (appState.allPapers.length === 0) {
            elements.papersList.innerHTML = `
                <div class="col-12 text-center text-muted">
                    <p>No question papers found.</p>
                </div>`;
            return;
        }

        renderPapers(appState.allPapers);

    } catch (error) {
        console.error('Error fetching papers:', error);
        elements.papersList.innerHTML = `
            <div class="col-12 text-center text-danger">
                <i class="bi bi-exclamation-triangle-fill fs-1"></i>
                <h5 class="my-2">Failed to load papers</h5>
                <p class="small text-muted">${error.message}</p>
            </div>`;
    }
}

function renderPapers(papers) {
    elements.papersList.innerHTML = '';

    if (papers.length === 0) {
        elements.papersList.innerHTML = '<div class="col-12 text-center text-muted">No matching papers found.</div>';
        return;
    }

    papers.forEach((paper, index) => {
        const cardCol = document.createElement('div');
        cardCol.className = 'col-lg-4 col-md-6 animate-fade-in';
        cardCol.innerHTML = `
            <div class="card h-100 paper-card border-0 shadow-sm" onclick="startQuiz('${paper.id}', '${paper.collectionName}')">
                <div class="card-body p-4 text-center">
                    <div class="paper-icon mb-3">
                        <i class="bi bi-file-text-fill"></i>
                    </div>
                    <h5 class="card-title fw-bold mb-2">${paper.title}</h5>
                    <p class="card-text text-muted small mb-3">${paper.subtitle}</p>
                    <span class="badge bg-light text-primary border border-primary rounded-pill px-3">
                        ${paper.questionCount} Questions
                    </span>
                    <div class="mt-2 text-muted" style="font-size: 0.75rem">
                        ID: ${paper.id.substring(0, 8)}...
                    </div>
                </div>
            </div>
        `;
        elements.papersList.appendChild(cardCol);
    });
}

// Search Handler
if (elements.paperSearch) {
    elements.paperSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = appState.allPapers.filter(paper =>
            paper.title.toLowerCase().includes(term) ||
            paper.subtitle.toLowerCase().includes(term) ||
            paper.id.toLowerCase().includes(term)
        );
        renderPapers(filtered);
    });
}

// --- Navigation Logic ---

function showQuizView() {
    elements.paperSelectionView.classList.add('d-none');
    elements.quizInterfaceView.classList.remove('d-none');
    appState.currentView = 'quiz';
}

function showPaperSelectionView() {
    elements.quizInterfaceView.classList.add('d-none');
    elements.paperSelectionView.classList.remove('d-none');
    appState.currentView = 'paper-selection';

    // Reset Quiz state
    if (quizState.timerInterval) clearInterval(quizState.timerInterval);

    // Reset PDF
    if (quizState.renderTask) {
        try { quizState.renderTask.cancel(); } catch (e) { }
        quizState.renderTask = null;
    }
    quizState.pdfDocument = null;

    quizState.answers = {};
    quizState.currentQuestion = 0;
    quizState.timeElapsed = 0;
    elements.timer.textContent = "00:00";
}

// --- Quiz Logic ---

async function startQuiz(paperId, collectionName = 'questionpapers') {
    appState.selectedPaperId = paperId;
    showQuizView();

    // Show loading state
    elements.questionsContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
        const doc = await db.collection(collectionName).doc(paperId).get();
        if (!doc.exists) throw new Error('Paper not found');

        const data = doc.data();
        // console.log('Selected Paper Data:', data);

        // Confirmed field name from logs: 'questions' (lowercase)
        quizState.questions = data.questions || [];

        if (quizState.questions.length === 0) {
            // Fallback just in case
            quizState.questions = data.Questions || [];
        }

        if (quizState.questions.length === 0) {
            alert('This paper has no questions or the data format is different than expected.');
        }

        quizState.totalQuestions = quizState.questions.length;
        quizState.startTime = Date.now();
        quizState.answers = {};

        // Initialize null answers
        quizState.questions.forEach((_, index) => quizState.answers[index] = null);

        renderQuestionNavigation();
        navigateToQuestion(0);
        updateProgress();
        startTimer();

        // Load PDF 
        const pdfUrl = data.pdfUrl || data.pdf || 'textbook.pdf';
        loadPdf(pdfUrl);

    } catch (error) {
        console.error('Error loading quiz:', error);
        alert('Error loading quiz: ' + error.message);
        showPaperSelectionView();
    }
}

function renderQuestionNavigation() {
    elements.questionNav.innerHTML = '';
    quizState.questions.forEach((_, index) => {
        const btn = document.createElement('div');
        btn.className = 'question-number';
        btn.textContent = index + 1;
        if (index === quizState.currentQuestion) btn.classList.add('active', 'current');
        btn.addEventListener('click', () => navigateToQuestion(index));
        elements.questionNav.appendChild(btn);
    });
}

function navigateToQuestion(index) {
    if (index < 0 || index >= quizState.totalQuestions) return;

    quizState.currentQuestion = index;

    // Update Nav UI
    document.querySelectorAll('.question-number').forEach((btn, idx) => {
        btn.classList.remove('current', 'active');
        if (idx === index) btn.classList.add('current', 'active');
        if (quizState.answers[idx] !== null) btn.classList.add('answered');
    });

    // Render Question
    const question = quizState.questions[index];
    renderQuestionCard(question, index);

    // Update Buttons
    elements.prevBtn.disabled = index === 0;
    elements.nextBtn.disabled = index === quizState.totalQuestions - 1;
}

function renderQuestionCard(question, index) {
    elements.questionsContainer.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'question-card active';

    const title = document.createElement('div');
    title.className = 'd-flex justify-content-between align-items-start mb-3';
    title.innerHTML = `<h5 class="fw-bold text-dark">Question ${index + 1}</h5>`;

    // Confirmed field from logs: 'Question' (Capitalized)
    const qText = question.Question || question.question || 'No question text available.';

    const text = document.createElement('div');
    text.className = 'mb-4 fs-5';
    text.textContent = qText;

    const optionsDiv = document.createElement('div');

    for (let i = 1; i <= 4; i++) {
        // Confirmed field from logs: 'Option 1', etc.
        const optionKey = `Option ${i}`;
        const optionText = question[optionKey] || question[`option ${i}`] || question[`Option${i}`];
        if (!optionText) continue;

        const isSelected = quizState.answers[index] === i;

        const label = document.createElement('div');
        label.className = `option-label ${isSelected ? 'selected' : ''}`;
        label.onclick = () => selectOption(index, i);

        label.innerHTML = `
            <div class="option-marker">${String.fromCharCode(64 + i)}</div>
            <div class="flex-grow-1">${optionText}</div>
        `;

        optionsDiv.appendChild(label);
    }

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(optionsDiv);
    elements.questionsContainer.appendChild(card);
}

function selectOption(qIndex, optionIndex) {
    quizState.answers[qIndex] = optionIndex;
    updateProgress();
    // Re-render to show selection
    navigateToQuestion(qIndex);
}

function updateProgress() {
    const answeredCount = Object.values(quizState.answers).filter(a => a !== null).length;
    const percent = quizState.totalQuestions > 0 ? (answeredCount / quizState.totalQuestions) * 100 : 0;

    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${answeredCount}/${quizState.totalQuestions}`;

    // Update nav dots
    document.querySelectorAll('.question-number').forEach((btn, idx) => {
        if (quizState.answers[idx] !== null) btn.classList.add('answered');
    });
}

function startTimer() {
    if (quizState.timerInterval) clearInterval(quizState.timerInterval);

    quizState.timerInterval = setInterval(() => {
        quizState.timeElapsed = Math.floor((Date.now() - quizState.startTime) / 1000);
        const m = Math.floor(quizState.timeElapsed / 60);
        const s = quizState.timeElapsed % 60;
        elements.timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

// --- PDF Logic ---

async function loadPdf(url) {
    // Reset state
    if (quizState.renderTask) {
        try { await quizState.renderTask.cancel(); } catch (e) { }
        quizState.renderTask = null;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(url);
        quizState.pdfDocument = await loadingTask.promise;

        elements.pageCount.textContent = quizState.pdfDocument.numPages;
        renderPdfPage(1);
    } catch (error) {
        console.error('Error loading PDF:', error);

        const ctx = elements.pdfCanvas.getContext('2d');
        elements.pdfCanvas.height = 150;
        ctx.font = '16px Arial';
        ctx.fillStyle = '#dc3545';
        ctx.fillText('Could not load PDF.', 10, 50);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#6c757d';
        ctx.fillText(error.message, 10, 80);

        if (error.message && error.message.includes('404')) {
            ctx.fillText('Ensure "textbook.pdf" is in the root folder.', 10, 100);
        }
    }
}

async function renderPdfPage(num) {
    if (!quizState.pdfDocument) return;
    if (num < 1 || num > quizState.pdfDocument.numPages) return;

    // Cancel any pending render
    if (quizState.renderTask) {
        try {
            await quizState.renderTask.cancel();
        } catch (error) {
            // Ignore cancel error
        }
    }

    quizState.currentPdfPage = num;
    elements.pageNum.textContent = num;

    const page = await quizState.pdfDocument.getPage(num);

    // Calculate scale to fit width of container
    const containerWidth = elements.pdfCanvas.parentElement.clientWidth;
    const viewportUnscaled = page.getViewport({ scale: 1 });
    const scale = (containerWidth - 40) / viewportUnscaled.width; // -40 for padding

    const viewport = page.getViewport({ scale: scale });

    elements.pdfCanvas.height = viewport.height;
    elements.pdfCanvas.width = viewport.width;

    const renderContext = {
        canvasContext: elements.pdfCanvas.getContext('2d'),
        viewport: viewport
    };

    // Keep track of the render task
    quizState.renderTask = page.render(renderContext);

    try {
        await quizState.renderTask.promise;
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('Render error:', error);
        }
    }
}


// --- Search & Submit ---
// Simple submit handler similar to before
function submitQuiz() {
    let score = 0;
    const results = [];

    quizState.questions.forEach((q, idx) => {
        const ans = quizState.answers[idx];

        // Confirmed field from logs: 'Correct Option'
        // Some records have it as empty string? Handle safely
        const correctVal = q['Correct Option'] || q['correct option'];
        let correct = null;

        if (correctVal) {
            correct = parseInt(correctVal); // Parse to int just in case it's a string "1"
        }

        const isCorrect = (ans === correct);

        // If there is no correct answer specified, technically you can't be "correct", 
        // or effectively everything is wrong unless handled otherwise.
        // For now, only score increments if we strictly match a logical correct answer.
        if (correct !== null && !isNaN(correct) && isCorrect) {
            score++;
        }

        results.push({
            q: q.Question || 'Question',
            userAns: q[`Option ${ans}`] || 'Skipped',
            correctAns: q[`Option ${correct}`] || 'Not specified',
            isCorrect
        });
    });

    const percent = quizState.totalQuestions > 0 ? ((score / quizState.totalQuestions) * 100).toFixed(1) : 0;
    const modalBody = document.getElementById('results-content');
    modalBody.innerHTML = `
        <div class="text-center mb-4">
            <h2 class="${percent >= 70 ? 'text-success' : 'text-primary'} fw-bold">${score} / ${quizState.totalQuestions}</h2>
            <p class="text-muted">You scored ${percent}%</p>
        </div>
        <div class="list-group">
            ${results.map((r, i) => `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">Q${i + 1}: ${r.q}</h6>
                        <small class="${r.isCorrect ? 'text-success' : 'text-danger'} fw-bold">${r.isCorrect ? 'Correct' : 'Wrong'}</small>
                    </div>
                    <small class="text-muted">Your answer: ${r.userAns}</small><br>
                    ${!r.isCorrect ? `<small class="text-success">Correct answer: ${r.correctAns}</small>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('resultsModal'));
    modal.show();
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Nav
    elements.prevBtn.onclick = () => navigateToQuestion(quizState.currentQuestion - 1);
    elements.nextBtn.onclick = () => navigateToQuestion(quizState.currentQuestion + 1);
    elements.submitBtn.onclick = submitQuiz;

    elements.backToListBtn.onclick = showPaperSelectionView;
    elements.mobileBackBtn.onclick = showPaperSelectionView;

    // PDF
    elements.prevPage.onclick = () => renderPdfPage(quizState.currentPdfPage - 1);
    elements.nextPage.onclick = () => renderPdfPage(quizState.currentPdfPage + 1);

    elements.pdfSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            alert('Search functionality requires advanced PDF text layer integration.');
        }
    });

    // Window resize handling for PDF
    window.addEventListener('resize', () => {
        if (appState.currentView === 'quiz') {
            renderPdfPage(quizState.currentPdfPage);
        }
    });
});
