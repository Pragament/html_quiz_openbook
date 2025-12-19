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
    quizzesList: document.getElementById('quizzes-list'),
    createQuizBtn: document.getElementById('create-quiz-btn'),
    viewReportsBtn: document.getElementById('view-reports-btn'),
    backToHome: document.getElementById('back-to-home'),
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
});

// Authentication
function initAuth() {
    auth.onAuthStateChanged(user => {
        state.currentUser = user;
        if (user) {
            elements.loginBtn.classList.add('d-none');
            elements.userInfo.classList.remove('d-none');
            elements.userName.textContent = user.displayName || user.email;
            elements.createQuizBtn.classList.remove('d-none');
        } else {
            elements.loginBtn.classList.remove('d-none');
            elements.userInfo.classList.add('d-none');
            elements.createQuizBtn.classList.add('d-none');
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
        const snapshot = await db.collection('quizzes').get();
        state.quizzes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQuizzes(state.quizzes);
    } catch (error) {
        elements.quizzesList.innerHTML = '<div class="col-12 text-center text-danger">Failed to load quizzes</div>';
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
        console.log(`Loaded ${state.questionPapers.length} question papers`);
    } catch (error) {
        console.error('Failed to load question papers:', error);
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
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="openbook-${i}" checked>
                <label class="form-check-label" for="openbook-${i}">Open Book (Show PDF Reference)</label>
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
}

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
        // Round 1 can be open book (check checkbox), Round 2+ is always closed book
        const openBook = i === 1 ? document.getElementById(`openbook-${i}`).checked : false;
        rounds.push({ papers, openBook });
    }

    try {
        await db.collection('quizzes').add({
            title, 
            numRounds, 
            numQuestions, 
            randomQuestions, 
            timeLimitEnabled, 
            timeLimit, 
            rounds,
            createdBy: state.currentUser.uid,
            createdByName: state.currentUser.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        bootstrap.Modal.getInstance(document.getElementById('createQuizModal')).hide();
        document.getElementById('quiz-form').reset();
        alert('Quiz created successfully!');
        loadQuizzes();
    } catch (error) {
        alert('Failed to create quiz: ' + error.message);
    }
});

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
                
                // Get PDF URL from first paper
                if (allQuestions.length === questions.length) {
                    pdfUrl = data.pdfUrl || data.pdf || 'textbook.pdf';
                }
            }
        } catch (error) {
            console.error(`Error loading paper ${paperId}:`, error);
        }
    }
    
    if (allQuestions.length === 0) {
        alert('No questions found in selected papers. Please check the quiz configuration.');
        showView('homepage');
        return;
    }
    
    console.log(`Total questions loaded: ${allQuestions.length}`);
    
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
    
    console.log(`Round ${roundNum} initialized with ${selectedQuestions.length} questions`);
    
    renderQuestions();
    
    // Load PDF if open book
    if (round.openBook) {
        loadPdf(pdfUrl);
    } else {
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
            console.warn(`Round ${r} data not found`);
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
    
    console.log('Generated report:', report);
    return report;
}

function saveReport(report) {
    const reports = JSON.parse(localStorage.getItem('quizReports') || '[]');
    reports.push(report);
    localStorage.setItem('quizReports', JSON.stringify(reports));
}

function showResults(report) {
    const totalTime = report.totalTime || 0;
    const totalMinutes = Math.floor(totalTime / 60);
    const totalSeconds = totalTime % 60;
    
    let html = `
        <div class="text-center mb-4">
            <h4 class="fw-bold">${report.quizTitle}</h4>
            <p class="text-muted">${new Date(report.submittedAt).toLocaleString()}</p>
            <p class="text-muted">Total Time: ${totalMinutes}m ${totalSeconds}s</p>
        </div>
    `;
    
    report.rounds.forEach(r => {
        const percentage = parseFloat(r.percentage) || 0;
        const grade = percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Fair' : 'Needs Improvement';
        const gradeColor = percentage >= 80 ? 'success' : percentage >= 60 ? 'info' : percentage >= 40 ? 'warning' : 'danger';
        
        // Create detailed breakdown
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
            <div class="mb-4 border rounded p-3">
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
    
    // Round comparison - especially useful when comparing same topics (open book vs closed book)
    if (report.rounds.length === 2) {
        const r1 = report.rounds[0];
        const r2 = report.rounds[1];
        const scoreDiff = (r2.score || 0) - (r1.score || 0);
        const percent1 = parseFloat(r1.percentage) || 0;
        const percent2 = parseFloat(r2.percentage) || 0;
        const percentDiff = (percent2 - percent1).toFixed(1);
        
        // Check if same papers used (same topics)
        const sameTopics = JSON.stringify(r1.paperIds?.sort()) === JSON.stringify(r2.paperIds?.sort());
        const topicNote = sameTopics ? 
            '<small class="d-block text-muted mt-2">📚 Same topics tested - comparing open book vs closed book performance</small>' : 
            '<small class="d-block text-muted mt-2">Different topics in each round</small>';
        
        html += `
            <div class="alert ${scoreDiff > 0 ? 'alert-success' : scoreDiff < 0 ? 'alert-danger' : 'alert-info'} mb-3">
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

// PDF Functions
async function loadPdf(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        state.pdfDocument = pdf;
        elements.pageCount.textContent = pdf.numPages;
        renderPdfPage(1);
    } catch (error) {
        console.error('PDF load error:', error);
    }
}

async function renderPdfPage(num) {
    if (!state.pdfDocument) return;
    const page = await state.pdfDocument.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 });
    elements.pdfCanvas.width = viewport.width;
    elements.pdfCanvas.height = viewport.height;
    await page.render({ canvasContext: elements.pdfCanvas.getContext('2d'), viewport }).promise;
    state.currentPdfPage = num;
    elements.pageNum.textContent = num;
}

elements.prevPage.addEventListener('click', () => renderPdfPage(state.currentPdfPage - 1));
elements.nextPage.addEventListener('click', () => renderPdfPage(state.currentPdfPage + 1));

// Timer
function startTimer(seconds) {
    let remaining = seconds;
    state.timerInterval = setInterval(() => {
        remaining--;
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        elements.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remaining <= 0) {
            clearInterval(state.timerInterval);
            alert('Time is up!');
            submitQuiz();
        }
    }, 1000);
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
    
    if (view === 'homepage') elements.homepage.classList.remove('d-none');
    else if (view === 'quiz') elements.quizInterface.classList.remove('d-none');
    else if (view === 'reports') elements.reportsView.classList.remove('d-none');
}

// Utilities
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initEventListeners() {
    document.getElementById('quiz-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.quizzes.filter(q => q.title.toLowerCase().includes(term));
        renderQuizzes(filtered);
    });
}
