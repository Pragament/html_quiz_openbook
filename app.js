// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFpwi3k7Qth9MiqqRGKstY0Zkj_vrcdFY",
    authDomain: "edutrack-admin.firebaseapp.com",
    projectId: "edutrack-admin",
    storageBucket: "edutrack-admin.firebasestorage.app",
    messagingSenderId: "193864081571",
    appId: "1:193864081571:web:7501afde01291f81e61f16"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// State Management
const state = {
    currentUser: null,
    currentView: 'homepage',
    quizzes: [],
    questionPapers: [],
    activeQuiz: null,
    currentRound: 1,
    roundAnswers: {},
    quizStartTime: null,
    timerInterval: null,
    pdfDocument: null,
    currentPdfPage: 1,
    quizInProgress: false
};

// DOM Elements
const elements = {
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
    userPhoto: document.getElementById('user-photo'),
    homepage: document.getElementById('homepage'),
    quizInterface: document.getElementById('quiz-interface'),
    reportsView: document.getElementById('reports-view'),
    myQuizzesView: document.getElementById('my-quizzes-view'),
    quizzesList: document.getElementById('quizzes-list'),
    createQuizBtn: document.getElementById('create-quiz-btn'),
    myQuizzesBtn: document.getElementById('my-quizzes-btn'),
    viewReportsBtn: document.getElementById('view-reports-btn'),
    backToHome: document.getElementById('back-to-home'),
    backToHomeFromQuizzes: document.getElementById('back-to-home-from-quizzes'),
    questionsContainer: document.getElementById('questions-container'),
    questionNav: document.getElementById('question-nav'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    timerDisplay: document.getElementById('timer-display'),
    roundDisplay: document.getElementById('round-display'),
    roundIndicator: document.getElementById('round-indicator'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    submitRoundBtn: document.getElementById('submit-round-btn'),
    pdfCanvas: document.getElementById('pdf-canvas'),
    pageNum: document.getElementById('page-num'),
    pageCount: document.getElementById('page-count'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initEventListeners();
    loadQuizzes();
    loadQuestionPapers();
    preventNavigation();
    checkUrlParameters();
});

// Initialize Event Listeners
function initEventListeners() {
    // Quiz search functionality
    const quizSearchInput = document.getElementById('quiz-search');
    if (quizSearchInput) {
        quizSearchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.quizzes.filter(q => 
                q.title.toLowerCase().includes(term)
            );
            renderQuizzes(filtered);
        });
    }
}

// Navigation Prevention
function preventNavigation() {
    window.addEventListener('beforeunload', (e) => {
        if (state.quizInProgress) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// View Management
function showView(view) {
    elements.homepage.classList.add('d-none');
    elements.quizInterface.classList.add('d-none');
    elements.reportsView.classList.add('d-none');
    elements.myQuizzesView.classList.add('d-none');
    
    if (view === 'homepage') {
        elements.homepage.classList.remove('d-none');
    } else if (view === 'quiz') {
        elements.quizInterface.classList.remove('d-none');
    } else if (view === 'reports') {
        elements.reportsView.classList.remove('d-none');
    } else if (view === 'my-quizzes') {
        elements.myQuizzesView.classList.remove('d-none');
    }
}

// PDF Functions
async function loadPdf(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        state.pdfDocument = pdf;
        elements.pageCount.textContent = pdf.numPages;
        await renderPdfPage(1);
    } catch (error) {
        alert('Failed to load PDF: ' + error.message);
    }
}

async function renderPdfPage(num) {
    if (!state.pdfDocument) return;
    
    try {
        const page = await state.pdfDocument.getPage(num);
        const viewport = page.getViewport({ scale: 1.5 });
        elements.pdfCanvas.width = viewport.width;
        elements.pdfCanvas.height = viewport.height;
        await page.render({ 
            canvasContext: elements.pdfCanvas.getContext('2d'), 
            viewport 
        }).promise;
        state.currentPdfPage = num;
        elements.pageNum.textContent = num;
    } catch (error) {
        // Silent error handling
    }
}

elements.prevPage.addEventListener('click', () => {
    if (state.currentPdfPage > 1) {
        renderPdfPage(state.currentPdfPage - 1);
    }
});

elements.nextPage.addEventListener('click', () => {
    if (state.pdfDocument && state.currentPdfPage < state.pdfDocument.numPages) {
        renderPdfPage(state.currentPdfPage + 1);
    }
});

// Utility Functions
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Timer Function
function startTimer(seconds) {
    let remaining = seconds;
    
    const updateTimer = () => {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        elements.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    };
    
    updateTimer(); // Initial display
    
    state.timerInterval = setInterval(() => {
        remaining--;
        updateTimer();
        
        if (remaining <= 0) {
            clearInterval(state.timerInterval);
            alert('Time is up!');
            submitQuiz();
        }
    }, 1000);
}

// Authentication
function initAuth() {
    auth.onAuthStateChanged(user => {
        state.currentUser = user;
        if (user) {
            elements.loginBtn.classList.add('d-none');
            elements.userInfo.classList.remove('d-none');
            elements.userName.textContent = user.displayName || user.email;
            elements.createQuizBtn.classList.remove('d-none');
            elements.myQuizzesBtn.classList.remove('d-none');
        } else {
            elements.loginBtn.classList.remove('d-none');
            elements.userInfo.classList.add('d-none');
            elements.createQuizBtn.classList.add('d-none');
            elements.myQuizzesBtn.classList.add('d-none');
        }
    });
}

elements.loginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

elements.logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Load Quizzes
async function loadQuizzes() {
    elements.quizzesList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border"></div></div>';
    try {
        const snapshot = await db.collection('quizzes').where('isPrivate', '==', false).get();
        state.quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQuizzes(state.quizzes);
    } catch (error) {
        // Fallback: load all quizzes if query fails (for backward compatibility)
        try {
            const snapshot = await db.collection('quizzes').get();
            state.quizzes = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(q => !q.isPrivate);
            renderQuizzes(state.quizzes);
        } catch (err) {
            elements.quizzesList.innerHTML = '<div class="col-12 text-center text-danger">Failed to load quizzes</div>';
        }
    }
}

function renderQuizzes(quizzes) {
    if (quizzes.length === 0) {
        elements.quizzesList.innerHTML = '<div class="col-12 text-center text-muted">No quizzes available. Create one to get started!</div>';
        return;
    }
    
    elements.quizzesList.innerHTML = quizzes.map(quiz => {
        const createdBy = quiz.createdByName || 'Unknown';
        const createdAt = quiz.createdAt ? new Date(quiz.createdAt.toDate()).toLocaleDateString() : '';
        
        return `
            <div class="col-md-4">
                <div class="card h-100 quiz-card" onclick="startQuiz('${quiz.id}')">
                    <div class="card-body">
                        <h5 class="card-title fw-bold">${quiz.title}</h5>
                        <div class="mb-2">
                            <span class="badge bg-primary">${quiz.numRounds} Round${quiz.numRounds > 1 ? 's' : ''}</span>
                            <span class="badge bg-info">${quiz.numQuestions} Questions</span>
                        </div>
                        ${quiz.timeLimitEnabled ? `<div class="mb-2"><span class="badge bg-warning text-dark">⏱ ${quiz.timeLimit} min</span></div>` : ''}
                        ${quiz.randomQuestions ? '<div class="mb-2"><span class="badge bg-secondary">🔀 Random</span></div>' : ''}
                        <div class="mt-3 pt-2 border-top">
                            <small class="text-muted">By ${createdBy}</small>
                            ${createdAt ? `<br><small class="text-muted">${createdAt}</small>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Load Question Papers
async function loadQuestionPapers() {
    try {
        const [lower, upper] = await Promise.all([
            db.collection('questionpapers').get().catch(() => ({ docs: [] })),
            db.collection('QuestionPapers').get().catch(() => ({ docs: [] }))
        ]);
        
        const papers = new Map();
        
        [...lower.docs, ...upper.docs].forEach(doc => {
            if (!papers.has(doc.id)) {
                const data = doc.data();
                const questions = data.questions || data.Questions || [];
                papers.set(doc.id, {
                    id: doc.id,
                    collection: lower.docs.find(d => d.id === doc.id) ? 'questionpapers' : 'QuestionPapers',
                    title: data.Title || data.title || data.Name || data.name || `Paper ${doc.id.substring(0, 8)}`,
                    subject: data.Subject || data.subject || '',
                    class: data.Class || data.class || '',
                    questionCount: questions.length,
                    questions: questions,
                    pdfUrl: data.pdfUrl || data.pdf || 'textbook.pdf'
                });
            }
        });
        
        state.questionPapers = Array.from(papers.values());
    } catch (error) {
        // Silent error handling
    }
}

// Create Quiz
elements.createQuizBtn.addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('createQuizModal'));
    modal.show();
    updateRoundsConfig();
});

document.getElementById('num-rounds').addEventListener('change', updateRoundsConfig);
document.getElementById('time-limit-enabled').addEventListener('change', (e) => {
    document.getElementById('time-limit-input').style.display = e.target.checked ? 'block' : 'none';
});

function updateRoundsConfig() {
    const numRounds = parseInt(document.getElementById('num-rounds').value);
    const container = document.getElementById('rounds-config');
    container.innerHTML = '';
    
    for (let i = 1; i <= numRounds; i++) {
        const paperOptions = state.questionPapers.map(p => {
            const info = p.class ? ` (Class: ${p.class})` : '';
            const qCount = ` - ${p.questionCount} questions`;
            return `<option value="${p.id}">${p.title}${info}${qCount}</option>`;
        }).join('');
        
        // Round 1 can be open book, Round 2 is always closed book
        const openBookOption = i === 1 ? `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" id="openbook-${i}" checked>
                <label class="form-check-label" for="openbook-${i}">Open Book (Show Reference Material)</label>
            </div>
            <div id="reference-config-${i}" class="border p-2 rounded bg-light">
                <div class="mb-2">
                    <label class="form-label small">Reference Material Type</label>
                    <select class="form-select form-select-sm" id="ref-type-${i}">
                        <option value="pdf-url">PDF URL</option>
                        <option value="webpage">Web Page (iframe)</option>
                    </select>
                </div>
                <div class="mb-2" id="pdf-url-${i}">
                    <label class="form-label small">PDF URL</label>
                    <input type="text" class="form-control form-control-sm" id="pdf-url-input-${i}" value="textbook.pdf" placeholder="https://example.com/document.pdf or textbook.pdf">
                    <small class="text-muted">Enter PDF filename or full URL</small>
                </div>
                <div class="mb-2 d-none" id="webpage-url-${i}">
                    <label class="form-label small">Web Page URL</label>
                    <input type="text" class="form-control form-control-sm" id="webpage-url-input-${i}" placeholder="https://example.com">
                    <small class="text-muted">Enter the URL of the web page to display</small>
                </div>
            </div>
        ` : `
            <div class="alert alert-info mb-0">
                <i class="bi bi-book"></i> <strong>Closed Book Round</strong> - No reference material will be shown
            </div>
        `;
        
        container.innerHTML += `
            <div class="mb-3 border p-3 rounded">
                <h6>Round ${i} ${i === 2 ? '📕' : '📖'}</h6>
                <div class="mb-2">
                    <label class="form-label">Question Papers (hold Ctrl/Cmd to select multiple)</label>
                    <select class="form-select round-papers" multiple size="5" data-round="${i}">
                        ${paperOptions}
                    </select>
                    <small class="text-muted">Selected papers will be combined for this round</small>
                </div>
                ${openBookOption}
            </div>
        `;
    }
    
    // Add event listeners for reference type toggle after DOM is updated
    setTimeout(() => {
        for (let i = 1; i <= numRounds; i++) {
            const refTypeSelect = document.getElementById(`ref-type-${i}`);
            if (refTypeSelect) {
                refTypeSelect.addEventListener('change', (e) => {
                    const pdfUrlDiv = document.getElementById(`pdf-url-${i}`);
                    const webpageDiv = document.getElementById(`webpage-url-${i}`);
                    
                    // Hide all
                    pdfUrlDiv.classList.add('d-none');
                    webpageDiv.classList.add('d-none');
                    
                    // Show selected
                    if (e.target.value === 'pdf-url') {
                        pdfUrlDiv.classList.remove('d-none');
                    } else if (e.target.value === 'webpage') {
                        webpageDiv.classList.remove('d-none');
                    }
                });
            }
        }
    }, 0);
}

// Start Quiz
async function startQuiz(quizId) {
    try {
        const doc = await db.collection('quizzes').doc(quizId).get();
        if (!doc.exists) throw new Error('Quiz not found');
        
        state.activeQuiz = { id: quizId, ...doc.data() };
        state.currentRound = 1;
        state.roundAnswers = {};
        state.quizInProgress = true;
        state.quizStartTime = Date.now();
        
        await loadRound(1);
        showView('quiz');
        
        if (state.activeQuiz.timeLimitEnabled) {
            startTimer(state.activeQuiz.timeLimit * 60);
        }
    } catch (error) {
        alert('Failed to start quiz: ' + error.message);
    }
}

async function loadRound(roundNum) {
    state.currentRound = roundNum;
    const round = state.activeQuiz.rounds[roundNum - 1];
    
    elements.roundDisplay.textContent = `Round ${roundNum}/${state.activeQuiz.numRounds}`;
    elements.roundIndicator.textContent = round.openBook ? 
        `Round ${roundNum}: Open Book - Reference material available` : 
        `Round ${roundNum}: Closed Book - No reference material`;
    
    // Fetch questions from Firebase for selected papers
    let allQuestions = [];
    let pdfUrl = 'textbook.pdf';
    
    for (const paperId of round.papers) {
        try {
            // Try both collections
            let paperDoc = await db.collection('questionpapers').doc(paperId).get();
            if (!paperDoc.exists) {
                paperDoc = await db.collection('QuestionPapers').doc(paperId).get();
            }
            
            if (paperDoc.exists) {
                const data = paperDoc.data();
                const questions = data.questions || data.Questions || [];
                allQuestions.push(...questions);
                
                // Get PDF URL from first paper (fallback)
                if (allQuestions.length === questions.length && !round.referenceConfig) {
                    pdfUrl = data.pdfUrl || data.pdf || 'textbook.pdf';
                }
            }
        } catch (error) {
            // Silent error handling
        }
    }
    
    if (allQuestions.length === 0) {
        alert('No questions found in selected papers. Please check the quiz configuration.');
        showView('homepage');
        return;
    }
    
    // Randomize if enabled
    if (state.activeQuiz.randomQuestions) {
        allQuestions = shuffleArray(allQuestions);
    }
    
    // Limit to configured number of questions
    const selectedQuestions = allQuestions.slice(0, state.activeQuiz.numQuestions);
    
    state.roundAnswers[roundNum] = {
        questions: selectedQuestions,
        answers: {},
        startTime: Date.now(),
        paperIds: round.papers
    };
    
    renderQuestions();
    
    // Load reference material if open book
    if (round.openBook) {
        if (round.referenceConfig) {
            if (round.referenceConfig.type === 'iframe') {
                loadIframe(round.referenceConfig.url);
            } else {
                loadPdf(round.referenceConfig.url);
            }
        } else {
            // Fallback to PDF
            loadPdf(pdfUrl);
        }
    } else {
        clearReferenceArea();
    }
}

function loadIframe(url) {
    const container = document.querySelector('.col-lg-6:last-child .glass-card');
    container.innerHTML = `
        <div class="p-3 border-bottom bg-light">
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Reference Material</h6>
                <a href="${url}" target="_blank" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-box-arrow-up-right"></i> Open in New Tab
                </a>
            </div>
        </div>
        <div class="flex-grow-1 overflow-auto">
            <iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
    `;
}

function clearReferenceArea() {
    const ctx = elements.pdfCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.pdfCanvas.width, elements.pdfCanvas.height);
    elements.pdfCanvas.width = 600;
    elements.pdfCanvas.height = 400;
    ctx.fillStyle = '#64748b';
    ctx.font = '20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Closed Book Round', 300, 200);
    ctx.font = '14px Inter';
    ctx.fillText('Reference material not available', 300, 230);
}

function renderQuestions() {
    const roundData = state.roundAnswers[state.currentRound];
    elements.questionNav.innerHTML = roundData.questions.map((_, i) => 
        `<div class="question-number" onclick="navigateToQuestion(${i})">${i + 1}</div>`
    ).join('');
    navigateToQuestion(0);
}

let currentQuestionIndex = 0;

function navigateToQuestion(index) {
    const roundData = state.roundAnswers[state.currentRound];
    if (index < 0 || index >= roundData.questions.length) return;
    
    currentQuestionIndex = index;
    const question = roundData.questions[index];
    
    elements.questionsContainer.innerHTML = `
        <div class="question-card">
            <h5>Question ${index + 1}</h5>
            <p class="fs-5">${question.Question || question.question}</p>
            <div class="options">
                ${[1, 2, 3, 4].map(i => {
                    const opt = question[`Option ${i}`] || question[`option ${i}`];
                    if (!opt) return '';
                    const selected = roundData.answers[index] === i;
                    return `
                        <div class="option-label ${selected ? 'selected' : ''}" onclick="selectOption(${index}, ${i})">
                            <div class="option-marker">${String.fromCharCode(64 + i)}</div>
                            <div>${opt}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    updateProgress();
    document.querySelectorAll('.question-number').forEach((el, i) => {
        el.classList.toggle('active', i === index);
        el.classList.toggle('answered', roundData.answers[i] !== undefined);
    });
}

function selectOption(qIndex, optIndex) {
    state.roundAnswers[state.currentRound].answers[qIndex] = optIndex;
    navigateToQuestion(qIndex);
}

function updateProgress() {
    const roundData = state.roundAnswers[state.currentRound];
    const answered = Object.keys(roundData.answers).length;
    const total = roundData.questions.length;
    const percent = (answered / total) * 100;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${answered}/${total}`;
}

elements.prevBtn.addEventListener('click', () => navigateToQuestion(currentQuestionIndex - 1));
elements.nextBtn.addEventListener('click', () => navigateToQuestion(currentQuestionIndex + 1));

elements.submitRoundBtn.addEventListener('click', async () => {
    const roundData = state.roundAnswers[state.currentRound];
    const answered = Object.keys(roundData.answers).length;
    const total = roundData.questions.length;
    
    if (answered < total) {
        const unanswered = total - answered;
        if (!confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`)) {
            return;
        }
    }
    
    if (state.currentRound < state.activeQuiz.numRounds) {
        if (confirm(`Submit Round ${state.currentRound} and move to Round ${state.currentRound + 1}?`)) {
            await loadRound(state.currentRound + 1);
        }
    } else {
        if (confirm('Submit quiz and view results?')) {
            submitQuiz();
        }
    }
});

function submitQuiz() {
    clearInterval(state.timerInterval);
    state.quizInProgress = false;
    
    const report = generateReport();
    saveReport(report);
    showResults(report);
    showView('homepage');
}

function generateReport() {
    const totalTime = state.quizStartTime ? Math.floor((Date.now() - state.quizStartTime) / 1000) : 0;
    
    const report = {
        quizId: state.activeQuiz.id,
        quizTitle: state.activeQuiz.title,
        submittedAt: new Date().toISOString(),
        totalTime: totalTime,
        rounds: []
    };
    
    for (let r = 1; r <= state.activeQuiz.numRounds; r++) {
        const roundData = state.roundAnswers[r];
        if (!roundData) {
            continue;
        }
        
        let score = 0;
        const details = [];
        const totalQuestions = roundData.questions ? roundData.questions.length : 0;
        
        if (roundData.questions) {
            roundData.questions.forEach((q, i) => {
                const userAns = roundData.answers[i];
                
                // Try multiple field name variations for correct answer
                const correctOption = q['Correct Option'] || q['correct option'] || q['CorrectOption'] || 
                                     q.correctOption || q['Correct option'] || q['correct Option'] ||
                                     q['Answer'] || q['answer'];
                
                // Parse the correct answer
                let correct = null;
                if (correctOption !== undefined && correctOption !== null && correctOption !== '') {
                    correct = parseInt(correctOption);
                }
                
                // Compare user answer with correct answer
                const isCorrect = correct !== null && !isNaN(correct) && userAns !== undefined && userAns === correct;
                
                if (isCorrect) score++;
                
                details.push({ 
                    question: q.Question || q.question || 'Question text not available',
                    userAns: userAns !== undefined ? userAns : 'Not answered',
                    correct: correct,
                    isCorrect 
                });
            });
        }
        
        const roundConfig = state.activeQuiz.rounds[r - 1];
        const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100) : 0;
        
        report.rounds.push({
            round: r,
            score: score,
            total: totalQuestions,
            percentage: percentage.toFixed(1),
            openBook: roundConfig ? roundConfig.openBook : false,
            paperIds: roundData.paperIds || [],
            details
        });
    }
    
    return report;
}

function saveReport(report) {
    const reports = JSON.parse(localStorage.getItem('quizReports') || '[]');
    reports.push(report);
    localStorage.setItem('quizReports', JSON.stringify(reports));
}

// View Reports
elements.viewReportsBtn.addEventListener('click', () => {
    const reports = JSON.parse(localStorage.getItem('quizReports') || '[]');
    const list = document.getElementById('reports-list');
    
    if (reports.length === 0) {
        list.innerHTML = '<p class="text-muted">No reports available. Complete a quiz to see your progress reports here.</p>';
    } else {
        // Sort by date, newest first
        const sortedReports = [...reports].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        
        list.innerHTML = sortedReports.map((r, i) => {
            const totalMinutes = Math.floor((r.totalTime || 0) / 60);
            const totalSeconds = (r.totalTime || 0) % 60;
            const avgScore = r.rounds.reduce((sum, round) => sum + parseFloat(round.percentage || 0), 0) / r.rounds.length;
            const gradeColor = avgScore >= 70 ? 'success' : avgScore >= 50 ? 'warning' : 'danger';
            
            // Store the report data directly in the button's data attribute
            const reportJson = encodeURIComponent(JSON.stringify(r));
            
            return `
                <div class="card mb-3 border-${gradeColor}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 class="mb-1">${r.quizTitle}</h5>
                                <p class="text-muted mb-2">
                                    <i class="bi bi-calendar"></i> ${new Date(r.submittedAt).toLocaleString()}
                                </p>
                                <div class="mb-2">
                                    <span class="badge bg-${gradeColor}">${avgScore.toFixed(1)}% Average</span>
                                    <span class="badge bg-secondary">${r.rounds.length} Round${r.rounds.length > 1 ? 's' : ''}</span>
                                    <span class="badge bg-info">${totalMinutes}m ${totalSeconds}s</span>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="viewReportByData(this)" data-report="${reportJson}">
                                <i class="bi bi-eye"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    showView('reports');
});

function viewReportByData(button) {
    const reportJson = button.getAttribute('data-report');
    const report = JSON.parse(decodeURIComponent(reportJson));
    showResults(report);
}

elements.backToHome.addEventListener('click', () => showView('homepage'));

// URL Parameter Handling
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quiz');
    const otp = urlParams.get('otp');
    
    if (quizId) {
        loadQuizFromUrl(quizId, otp);
    }
}

async function loadQuizFromUrl(quizId, otp) {
    try {
        console.log('🔗 Loading quiz from URL:', quizId, 'OTP:', otp);
        
        const doc = await db.collection('quizzes').doc(quizId).get();
        if (!doc.exists) {
            console.error('❌ Quiz not found:', quizId);
            alert('Quiz not found');
            return;
        }
        
        const quizData = doc.data();
        console.log('📋 Quiz data:', quizData);
        
        // Check if quiz is private
        if (quizData.isPrivate) {
            console.log('🔒 Quiz is private, checking OTP...');
            
            if (!otp) {
                console.log('⚠️ No OTP in URL, showing OTP modal');
                // Show OTP modal only if no OTP in URL
                showOtpModal(quizId);
                return;
            }
            
            // OTP is in URL, verify it directly
            console.log('🔑 OTP found in URL, verifying:', otp);
            const otpValid = await verifyOtp(quizId, otp);
            if (!otpValid) {
                console.error('❌ Invalid OTP from URL');
                alert('Invalid or expired OTP. Please contact the quiz creator for a valid link.');
                return;
            }
            console.log('✅ OTP verified successfully from URL');
        } else {
            console.log('🌐 Quiz is public, no OTP required');
        }
        
        // Start quiz
        console.log('🚀 Starting quiz...');
        startQuiz(quizId);
    } catch (error) {
        console.error('❌ Failed to load quiz:', error);
        alert('Failed to load quiz: ' + error.message);
    }
}

function showOtpModal(quizId) {
    const modal = new bootstrap.Modal(document.getElementById('otpModal'));
    modal.show();
    
    document.getElementById('verify-otp-btn').onclick = async () => {
        const otp = document.getElementById('otp-input').value.trim();
        if (!otp) {
            alert('Please enter OTP');
            return;
        }
        
        const valid = await verifyOtp(quizId, otp);
        if (valid) {
            modal.hide();
            startQuiz(quizId);
        } else {
            alert('Invalid or expired OTP');
        }
    };
}

async function verifyOtp(quizId, otp) {
    try {
        const snapshot = await db.collection('quizzes').doc(quizId).collection('otps')
            .where('code', '==', otp)
            .where('used', '==', false)
            .get();
        
        if (snapshot.empty) {
            return false;
        }
        
        // Mark OTP as used
        const otpDoc = snapshot.docs[0];
        await otpDoc.ref.update({ used: true, usedAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        return true;
    } catch (error) {
        return false;
    }
}

// My Quizzes View
elements.myQuizzesBtn.addEventListener('click', async () => {
    if (!state.currentUser) {
        alert('Please login to view your quizzes');
        return;
    }
    
    const list = document.getElementById('my-quizzes-list');
    list.innerHTML = '<div class="text-center"><div class="spinner-border"></div></div>';
    
    try {
        const snapshot = await db.collection('quizzes')
            .where('createdBy', '==', state.currentUser.uid)
            .get();
        
        const myQuizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (myQuizzes.length === 0) {
            list.innerHTML = '<p class="text-muted">You haven\'t created any quizzes yet.</p>';
        } else {
            list.innerHTML = await Promise.all(myQuizzes.map(async quiz => {
                const createdAt = quiz.createdAt ? new Date(quiz.createdAt.toDate()).toLocaleDateString() : '';
                const quizUrl = `${window.location.origin}${window.location.pathname}?quiz=${quiz.id}`;
                
                let otpSection = '';
                if (quiz.isPrivate) {
                    // Load OTPs for this quiz
                    const otpSnapshot = await db.collection('quizzes').doc(quiz.id).collection('otps').get();
                    const otps = otpSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    const otpList = otps.length > 0 ? otps.map(otp => `
                        <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded bg-white">
                            <div class="d-flex align-items-center">
                                <code class="me-2 fs-6 fw-bold">${otp.code}</code>
                                <span class="badge ${otp.used ? 'bg-secondary' : 'bg-success'}">
                                    ${otp.used ? 'Used' : 'Active'}
                                </span>
                            </div>
                            ${!otp.used ? `
                                <button class="btn btn-sm btn-primary" onclick="shareOtpUrl('${quiz.id}', '${otp.code}')" title="Share URL with OTP">
                                    <i class="bi bi-share-fill"></i> Share
                                </button>
                            ` : ''}
                        </div>
                    `).join('') : '<small class="text-muted">No OTPs generated yet. Click "Generate OTP" to create one.</small>';
                    
                    otpSection = `
                        <div class="mt-3 p-3 bg-light rounded border">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <strong>Access Codes (OTPs):</strong>
                                <button class="btn btn-sm btn-success" onclick="generateOtp('${quiz.id}')">
                                    <i class="bi bi-plus-circle"></i> Generate OTP
                                </button>
                            </div>
                            <div id="otp-list-${quiz.id}">
                                ${otpList}
                            </div>
                        </div>
                    `;
                }
                
                return `
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h5 class="mb-0">${quiz.title}</h5>
                                <span class="badge ${quiz.isPrivate ? 'bg-warning text-dark' : 'bg-success'}">
                                    ${quiz.isPrivate ? '🔒 Private' : '🌐 Public'}
                                </span>
                            </div>
                            <div class="mb-2">
                                <span class="badge bg-primary">${quiz.numRounds} Round${quiz.numRounds > 1 ? 's' : ''}</span>
                                <span class="badge bg-info">${quiz.numQuestions} Questions</span>
                            </div>
                            <small class="text-muted d-block mb-2">Created: ${createdAt}</small>
                            <div class="input-group input-group-sm">
                                <input type="text" class="form-control" value="${quizUrl}" readonly id="url-${quiz.id}">
                                <button class="btn btn-outline-secondary" onclick="copyQuizUrl('${quiz.id}')">
                                    <i class="bi bi-clipboard"></i> Copy
                                </button>
                            </div>
                            ${otpSection}
                        </div>
                    </div>
                `;
            })).then(items => items.join(''));
        }
        
        showView('my-quizzes');
    } catch (error) {
        list.innerHTML = '<p class="text-danger">Failed to load quizzes: ' + error.message + '</p>';
    }
});

elements.backToHomeFromQuizzes.addEventListener('click', () => showView('homepage'));

async function generateOtp(quizId) {
    if (!state.currentUser) {
        return;
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        await db.collection('quizzes').doc(quizId).collection('otps').add({
            code: otp,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: state.currentUser.uid,
            used: false
        });
        
        alert(`OTP Generated: ${otp}\n\nShare this URL:\n${window.location.origin}${window.location.pathname}?quiz=${quizId}&otp=${otp}`);
        
        // Refresh the quiz list
        elements.myQuizzesBtn.click();
    } catch (error) {
        alert('Failed to generate OTP: ' + error.message);
    }
}

function copyQuizUrl(quizId) {
    const input = document.getElementById(`url-${quizId}`);
    input.select();
    document.execCommand('copy');
    alert('Quiz URL copied to clipboard!');
}

function shareOtpUrl(quizId, otp) {
    const url = `${window.location.origin}${window.location.pathname}?quiz=${quizId}&otp=${otp}`;
    
    console.log('📤 Sharing OTP URL:', url);
    
    // Try to copy to clipboard
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            alert(`OTP URL copied to clipboard!\n\n${url}\n\nShare this URL with students.`);
        }).catch(() => {
            // Fallback
            showUrlDialog(url);
        });
    } else {
        showUrlDialog(url);
    }
}

function showUrlDialog(url) {
    const message = `Share this URL with students:\n\n${url}`;
    
    // Try Web Share API (mobile)
    if (navigator.share) {
        navigator.share({
            title: 'Quiz Access Link',
            text: 'Access the quiz using this link:',
            url: url
        }).catch(() => {
            // If share fails, show alert
            alert(message);
        });
    } else {
        alert(message);
    }
}

// Download and Share Results
let currentReport = null;

function showResults(report) {
    currentReport = report;
    const totalTime = report.totalTime || 0;
    const totalMinutes = Math.floor(totalTime / 60);
    const totalSeconds = totalTime % 60;
    
    let html = `
        <div class="text-center mb-4" id="result-summary">
            <h4 class="fw-bold">${report.quizTitle}</h4>
            <p class="text-muted">${new Date(report.submittedAt).toLocaleString()}</p>
            <p class="text-muted">Total Time: ${totalMinutes}m ${totalSeconds}s</p>
        </div>
    `;
    
    report.rounds.forEach(r => {
        const percentage = parseFloat(r.percentage) || 0;
        const grade = percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Fair' : 'Needs Improvement';
        const gradeColor = percentage >= 80 ? 'success' : percentage >= 60 ? 'info' : percentage >= 40 ? 'warning' : 'danger';
        
        let detailsHtml = '';
        if (r.details && r.details.length > 0) {
            const correctCount = r.details.filter(d => d.isCorrect).length;
            const wrongCount = r.details.filter(d => !d.isCorrect && d.userAns !== 'Not answered').length;
            const skippedCount = r.details.filter(d => d.userAns === 'Not answered').length;
            
            detailsHtml = `
                <div class="mt-2 small">
                    <span class="badge bg-success me-1">✓ ${correctCount} Correct</span>
                    <span class="badge bg-danger me-1">✗ ${wrongCount} Wrong</span>
                    ${skippedCount > 0 ? `<span class="badge bg-secondary">− ${skippedCount} Skipped</span>` : ''}
                </div>
            `;
        }
        
        html += `
            <div class="mb-4 border rounded p-3 result-round">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">Round ${r.round} ${r.openBook ? '📖 (Open Book)' : '📕 (Closed Book)'}</h5>
                    <span class="badge bg-${gradeColor}">${grade}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                    <span class="fs-4 fw-bold">${r.score || 0}/${r.total || 0}</span>
                    <span class="fs-4 fw-bold text-${gradeColor}">${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress mb-2" style="height: 10px;">
                    <div class="progress-bar bg-${gradeColor}" style="width: ${percentage}%"></div>
                </div>
                ${detailsHtml}
            </div>
        `;
    });
    
    if (report.rounds.length === 2) {
        const r1 = report.rounds[0];
        const r2 = report.rounds[1];
        const scoreDiff = (r2.score || 0) - (r1.score || 0);
        const percent1 = parseFloat(r1.percentage) || 0;
        const percent2 = parseFloat(r2.percentage) || 0;
        const percentDiff = (percent2 - percent1).toFixed(1);
        
        const sameTopics = JSON.stringify(r1.paperIds?.sort()) === JSON.stringify(r2.paperIds?.sort());
        const topicNote = sameTopics ? 
            '<small class="d-block text-muted mt-2">📚 Same topics tested - comparing open book vs closed book performance</small>' : 
            '<small class="d-block text-muted mt-2">Different topics in each round</small>';
        
        html += `
            <div class="alert ${scoreDiff > 0 ? 'alert-success' : scoreDiff < 0 ? 'alert-danger' : 'alert-info'} mb-3 result-comparison">
                <h6 class="alert-heading">📊 Round 2 vs Round 1 Comparison</h6>
                <div class="row mb-2">
                    <div class="col-6">
                        <strong>Round 1:</strong> ${r1.openBook ? '📖 Open Book' : '📕 Closed Book'}<br>
                        Score: ${r1.score}/${r1.total} (${r1.percentage}%)
                    </div>
                    <div class="col-6">
                        <strong>Round 2:</strong> ${r2.openBook ? '📖 Open Book' : '📕 Closed Book'}<br>
                        Score: ${r2.score}/${r2.total} (${r2.percentage}%)
                    </div>
                </div>
                <hr>
                <p class="mb-0 fw-bold">
                    Performance Change: ${scoreDiff > 0 ? '+' : ''}${scoreDiff} questions 
                    (${percentDiff > 0 ? '+' : ''}${percentDiff}%)
                </p>
                <small>${scoreDiff > 0 ? '🎉 Great improvement! You performed better without the book.' : 
                        scoreDiff < 0 ? '📚 The book helped! Consider reviewing the material more.' : 
                        '✓ Consistent performance across both rounds.'}</small>
                ${topicNote}
            </div>
        `;
    }
    
    document.getElementById('results-content').innerHTML = html;
    new bootstrap.Modal(document.getElementById('resultsModal')).show();
}

// Download Result as Image
document.getElementById('download-result-btn').addEventListener('click', async () => {
    if (!currentReport) return;
    
    try {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600 + (currentReport.rounds.length * 150);
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 32px Inter, Arial';
        ctx.textAlign = 'center';
        ctx.fillText(currentReport.quizTitle, 400, 50);
        
        // Date
        ctx.font = '16px Inter, Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText(new Date(currentReport.submittedAt).toLocaleString(), 400, 80);
        
        // Time
        const totalMinutes = Math.floor((currentReport.totalTime || 0) / 60);
        const totalSeconds = (currentReport.totalTime || 0) % 60;
        ctx.fillText(`Total Time: ${totalMinutes}m ${totalSeconds}s`, 400, 105);
        
        let yPos = 150;
        
        // Rounds
        currentReport.rounds.forEach((r, idx) => {
            const percentage = parseFloat(r.percentage) || 0;
            const grade = percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Fair' : 'Needs Improvement';
            
            // Round box
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(50, yPos, 700, 120);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.strokeRect(50, yPos, 700, 120);
            
            // Round title
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px Inter, Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Round ${r.round} ${r.openBook ? '📖' : '📕'}`, 70, yPos + 35);
            
            // Grade
            ctx.font = '18px Inter, Arial';
            ctx.textAlign = 'right';
            ctx.fillText(grade, 730, yPos + 35);
            
            // Score
            ctx.font = 'bold 36px Inter, Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${r.score || 0}/${r.total || 0}`, 70, yPos + 80);
            
            // Percentage
            const color = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#3b82f6' : percentage >= 40 ? '#f59e0b' : '#ef4444';
            ctx.fillStyle = color;
            ctx.textAlign = 'right';
            ctx.fillText(`${percentage.toFixed(1)}%`, 730, yPos + 80);
            
            // Progress bar
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(70, yPos + 95, 660, 10);
            ctx.fillStyle = color;
            ctx.fillRect(70, yPos + 95, (660 * percentage / 100), 10);
            
            yPos += 140;
        });
        
        // Convert to blob and download
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quiz-result-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
        
        alert('Result image downloaded!');
    } catch (error) {
        alert('Failed to generate image: ' + error.message);
    }
});

// Share Result
document.getElementById('share-result-btn').addEventListener('click', async () => {
    if (!currentReport) return;
    
    const totalMinutes = Math.floor((currentReport.totalTime || 0) / 60);
    const totalSeconds = (currentReport.totalTime || 0) % 60;
    
    let text = `📊 Quiz Results: ${currentReport.quizTitle}\n`;
    text += `⏱️ Time: ${totalMinutes}m ${totalSeconds}s\n\n`;
    
    currentReport.rounds.forEach(r => {
        const percentage = parseFloat(r.percentage) || 0;
        text += `Round ${r.round} ${r.openBook ? '📖' : '📕'}: ${r.score}/${r.total} (${percentage.toFixed(1)}%)\n`;
    });
    
    if (currentReport.rounds.length === 2) {
        const r1 = currentReport.rounds[0];
        const r2 = currentReport.rounds[1];
        const scoreDiff = (r2.score || 0) - (r1.score || 0);
        text += `\n📈 Improvement: ${scoreDiff > 0 ? '+' : ''}${scoreDiff} questions`;
    }
    
    // Try Web Share API
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Quiz Results',
                text: text
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                fallbackShare(text);
            }
        }
    } else {
        fallbackShare(text);
    }
});

function fallbackShare(text) {
    // WhatsApp share
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
}

// Update save quiz to include privacy and reference settings
document.getElementById('save-quiz-btn').addEventListener('click', async () => {
    if (!state.currentUser) {
        alert('Please login to create quizzes');
        return;
    }
    
    const title = document.getElementById('quiz-title').value;
    if (!title.trim()) {
        alert('Please enter a quiz title');
        return;
    }
    
    const isPrivate = document.getElementById('quiz-private').checked;
    const numRounds = parseInt(document.getElementById('num-rounds').value);
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    const randomQuestions = document.getElementById('random-questions').checked;
    const timeLimitEnabled = document.getElementById('time-limit-enabled').checked;
    const timeLimit = parseInt(document.getElementById('time-limit').value);

    const rounds = [];
    for (let i = 1; i <= numRounds; i++) {
        const papers = Array.from(document.querySelector(`[data-round="${i}"]`).selectedOptions).map(o => o.value);
        if (papers.length === 0) {
            alert(`Please select at least one question paper for Round ${i}`);
            return;
        }
        
        const openBook = i === 1 ? document.getElementById(`openbook-${i}`).checked : false;
        
        let referenceConfig = null;
        if (openBook) {
            const refType = document.getElementById(`ref-type-${i}`).value;
            
            if (refType === 'pdf-url') {
                const pdfUrl = document.getElementById(`pdf-url-input-${i}`).value;
                if (!pdfUrl) {
                    alert(`Please enter a PDF URL for Round ${i}`);
                    return;
                }
                referenceConfig = {
                    type: 'pdf',
                    url: pdfUrl
                };
            } else if (refType === 'webpage') {
                const webpageUrl = document.getElementById(`webpage-url-input-${i}`).value;
                if (!webpageUrl) {
                    alert(`Please enter a web page URL for Round ${i}`);
                    return;
                }
                referenceConfig = {
                    type: 'iframe',
                    url: webpageUrl
                };
            }
        }
        
        rounds.push({ papers, openBook, referenceConfig });
    }

    const quizData = {
        title, 
        isPrivate,
        numRounds, 
        numQuestions, 
        randomQuestions, 
        timeLimitEnabled, 
        timeLimit, 
        rounds,
        createdBy: state.currentUser.uid,
        createdByName: state.currentUser.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = await db.collection('quizzes').add(quizData);
        
        bootstrap.Modal.getInstance(document.getElementById('createQuizModal')).hide();
        document.getElementById('quiz-form').reset();
        alert('Quiz created successfully!');
        loadQuizzes();
    } catch (error) {
        alert('Failed to create quiz: ' + error.message);
    }
});
