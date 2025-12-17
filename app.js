// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
    pdfScale: 1.5
};

// DOM Elements
const elements = {
    questionsContainer: document.getElementById('questions-container'),
    questionNav: document.getElementById('question-nav'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    submitBtn: document.getElementById('submit-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    timer: document.getElementById('timer'),
    pdfCanvas: document.getElementById('pdf-canvas'),
    pageNum: document.getElementById('page-num'),
    pageCount: document.getElementById('page-count'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pdfSearch: document.getElementById('pdf-search')
};

// Initialize Quiz
async function initQuiz(questionPaperID = "692fee1c3bd2b58549614e6d") {
    try {
        // Load questions from Firestore
        const doc = await db.collection('questionpapers').doc(questionPaperID).get();
        if (!doc.exists) {
            throw new Error('Question paper not found');
        }

        const data = doc.data();
        quizState.questions = data.questions || [];
        quizState.totalQuestions = quizState.questions.length;
        quizState.startTime = Date.now();

        // Initialize answers object
        quizState.answers = {};
        quizState.questions.forEach((_, index) => {
            quizState.answers[index] = null;
        });

        // Render quiz
        renderQuestionNavigation();
        renderCurrentQuestion();
        updateProgress();
        startTimer();

        // Load PDF (example PDF - replace with your textbook URL)
        loadPdf('https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf');

    } catch (error) {
        console.error('Error initializing quiz:', error);
        alert('Failed to load quiz. Please try again.');
    }
}

// Render Question Navigation
function renderQuestionNavigation() {
    elements.questionNav.innerHTML = '';
    
    quizState.questions.forEach((_, index) => {
        const questionNumber = document.createElement('div');
        questionNumber.className = 'question-number';
        if (index === quizState.currentQuestion) {
            questionNumber.classList.add('active', 'current');
        }
        if (quizState.answers[index] !== null) {
            questionNumber.classList.add('answered');
        }
        
        questionNumber.textContent = index + 1;
        questionNumber.addEventListener('click', () => navigateToQuestion(index));
        
        elements.questionNav.appendChild(questionNumber);
    });
}

// Render Current Question
function renderCurrentQuestion() {
    elements.questionsContainer.innerHTML = '';
    
    const question = quizState.questions[quizState.currentQuestion];
    if (!question) return;

    const questionCard = document.createElement('div');
    questionCard.className = 'question-card active';
    
    // Question text
    const questionText = document.createElement('h5');
    questionText.className = 'mb-4';
    questionText.textContent = `Q${quizState.currentQuestion + 1}: ${question.Question || ''}`;
    questionCard.appendChild(questionText);

    // Chapter/Class info
    const metaInfo = document.createElement('div');
    metaInfo.className = 'mb-3 text-muted small';
    metaInfo.innerHTML = `
        <span class="badge bg-secondary me-2">${question.Chapter || 'No Chapter'}</span>
        <span class="badge bg-info me-2">${question.Class || 'No Class'}</span>
        <span class="badge bg-warning">${question.Topic || 'No Topic'}</span>
    `;
    questionCard.appendChild(metaInfo);

    // Options
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'mb-3';
    
    for (let i = 1; i <= 4; i++) {
        const optionText = question[`Option ${i}`];
        if (!optionText) continue;

        const label = document.createElement('label');
        label.className = 'option-label';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'question-' + quizState.currentQuestion;
        input.value = i;
        input.style.display = 'none';
        
        if (quizState.answers[quizState.currentQuestion] === i) {
            label.classList.add('selected');
            input.checked = true;
        }
        
        input.addEventListener('change', () => selectOption(i));
        
        const optionContent = document.createElement('div');
        optionContent.innerHTML = `<strong>${String.fromCharCode(64 + i)}.</strong> ${optionText}`;
        
        label.appendChild(input);
        label.appendChild(optionContent);
        optionsContainer.appendChild(label);
    }
    
    questionCard.appendChild(optionsContainer);
    elements.questionsContainer.appendChild(questionCard);
}

// Select Option
function selectOption(optionIndex) {
    quizState.answers[quizState.currentQuestion] = optionIndex;
    
    // Update UI
    const labels = document.querySelectorAll('.option-label');
    labels.forEach(label => {
        label.classList.remove('selected');
        const input = label.querySelector('input');
        if (input && parseInt(input.value) === optionIndex) {
            label.classList.add('selected');
        }
    });
    
    updateNavigation();
    updateProgress();
}

// Navigation Functions
function navigateToQuestion(index) {
    if (index < 0 || index >= quizState.totalQuestions) return;
    
    quizState.currentQuestion = index;
    renderCurrentQuestion();
    renderQuestionNavigation();
    updateNavigationButtons();
}

function updateNavigationButtons() {
    elements.prevBtn.disabled = quizState.currentQuestion === 0;
    elements.nextBtn.disabled = quizState.currentQuestion === quizState.totalQuestions - 1;
}

function updateNavigation() {
    renderQuestionNavigation();
    updateNavigationButtons();
}

// Progress Tracking
function updateProgress() {
    const answered = Object.values(quizState.answers).filter(answer => answer !== null).length;
    const progress = (answered / quizState.totalQuestions) * 100;
    
    elements.progressBar.style.width = `${progress}%`;
    elements.progressText.textContent = `${answered}/${quizState.totalQuestions}`;
}

// Timer
function startTimer() {
    setInterval(() => {
        quizState.timeElapsed = Math.floor((Date.now() - quizState.startTime) / 1000);
        const minutes = Math.floor(quizState.timeElapsed / 60);
        const seconds = quizState.timeElapsed % 60;
        elements.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// PDF.js Integration
async function loadPdf(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        quizState.pdfDocument = await loadingTask.promise;
        
        // Display total page count
        elements.pageCount.textContent = quizState.pdfDocument.numPages;
        
        // Render first page
        await renderPdfPage(1);
    } catch (error) {
        console.error('Error loading PDF:', error);
    }
}

async function renderPdfPage(pageNum) {
    if (!quizState.pdfDocument || pageNum < 1 || pageNum > quizState.pdfDocument.numPages) return;
    
    quizState.currentPdfPage = pageNum;
    elements.pageNum.textContent = pageNum;
    
    const page = await quizState.pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: quizState.pdfScale });
    
    // Set canvas dimensions
    elements.pdfCanvas.height = viewport.height;
    elements.pdfCanvas.width = viewport.width;
    
    const context = elements.pdfCanvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
}

// PDF Search Functionality
function setupPdfSearch() {
    elements.pdfSearch.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const searchTerm = elements.pdfSearch.value.trim();
            if (!searchTerm) return;
            
            // This is a simplified search - for full text search you'd need PDF.js text layer
            alert(`Searching for "${searchTerm}" in PDF. Note: Full text search requires additional setup with PDF.js text layer.`);
        }
    });
}

// Submit Quiz
async function submitQuiz() {
    // Calculate score
    let score = 0;
    const results = [];
    
    quizState.questions.forEach((question, index) => {
        const userAnswer = quizState.answers[index];
        const correctAnswer = parseInt(question['Correct Option']);
        const isCorrect = userAnswer === correctAnswer;
        
        if (isCorrect) score++;
        
        results.push({
            question: question.Question,
            userAnswer: question[`Option ${userAnswer}`] || 'Not answered',
            correctAnswer: question[`Option ${correctAnswer}`] || 'No correct answer specified',
            isCorrect
        });
    });
    
    // Display results
    const modal = new bootstrap.Modal(document.getElementById('resultsModal'));
    const resultsContent = document.getElementById('results-content');
    
    const percentage = ((score / quizState.totalQuestions) * 100).toFixed(1);
    
    resultsContent.innerHTML = `
        <div class="text-center mb-4">
            <h3 class="text-primary">Quiz Completed!</h3>
            <div class="display-4 fw-bold ${percentage >= 70 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-danger'}">
                ${score}/${quizState.totalQuestions}
            </div>
            <div class="fs-5">(${percentage}%)</div>
            <div class="mt-3">Time taken: ${formatTime(quizState.timeElapsed)}</div>
        </div>
        
        <div class="mt-4">
            <h5>Detailed Results:</h5>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Question</th>
                            <th>Your Answer</th>
                            <th>Correct Answer</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map((result, idx) => `
                            <tr>
                                <td>Q${idx + 1}: ${result.question.substring(0, 50)}...</td>
                                <td>${result.userAnswer.substring(0, 30)}...</td>
                                <td>${result.correctAnswer.substring(0, 30)}...</td>
                                <td>
                                    <span class="badge ${result.isCorrect ? 'bg-success' : 'bg-danger'}">
                                        ${result.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    modal.show();
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize quiz
    initQuiz();
    
    // Navigation buttons
    elements.prevBtn.addEventListener('click', () => navigateToQuestion(quizState.currentQuestion - 1));
    elements.nextBtn.addEventListener('click', () => navigateToQuestion(quizState.currentQuestion + 1));
    elements.submitBtn.addEventListener('click', submitQuiz);
    
    // PDF navigation
    elements.prevPage.addEventListener('click', () => renderPdfPage(quizState.currentPdfPage - 1));
    elements.nextPage.addEventListener('click', () => renderPdfPage(quizState.currentPdfPage + 1));
    
    // Setup PDF search
    setupPdfSearch();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowLeft':
                if (!e.ctrlKey) {
                    navigateToQuestion(quizState.currentQuestion - 1);
                } else {
                    renderPdfPage(quizState.currentPdfPage - 1);
                }
                break;
            case 'ArrowRight':
                if (!e.ctrlKey) {
                    navigateToQuestion(quizState.currentQuestion + 1);
                } else {
                    renderPdfPage(quizState.currentPdfPage + 1);
                }
                break;
            case '1':
            case '2':
            case '3':
            case '4':
                if (!e.ctrlKey) {
                    selectOption(parseInt(e.key));
                }
                break;
        }
    });
});
