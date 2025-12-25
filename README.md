# Quiz Platform

A comprehensive multi-round quiz application with Firebase authentication, open book vs closed book testing, and detailed progress tracking.

## 🎯 Key Features

### 🔐 User Access Control

#### Authenticated Users (Google Login)
- ✅ Create custom quizzes (saved to Firestore)
- ✅ Take any quiz
- ✅ View detailed results and reports
- ✅ Access historical reports (localStorage)

#### Anonymous Users (No Login Required)
- ✅ Browse all available quizzes
- ✅ Take any quiz
- ✅ View results after submission
- ✅ Access past reports (localStorage)
- ❌ Cannot create quizzes

### 📝 Quiz Creation (Authenticated Users Only)

**Configuration Options:**
- Quiz title and description
- Number of rounds: 1-2
- Number of questions per quiz
- Random question order: Yes/No
- Time limit: Optional with auto-submit
- Question paper selection: Multiple papers per round

**Round Configuration:**
- **Round 1**: Can be Open Book (PDF reference available)
- **Round 2**: Always Closed Book (no reference material)
- Select different or same question papers per round
- Combine multiple question papers in one round

### 🎓 Quiz Taking Experience

**Multi-Round Support:**
- Up to 2 rounds per quiz
- Clear round indicators (📖 Open Book / 📕 Closed Book)
- Seamless transition between rounds

**Open Book Mode (Round 1):**
- Split-screen interface
- Questions on left, PDF viewer on right
- Navigate PDF pages while answering
- Search within PDF (basic)

**Closed Book Mode (Round 2):**
- Questions only interface
- No reference material available
- Tests knowledge retention

**Interactive Features:**
- Visual question navigation grid
- Progress bar showing completion
- Answered questions highlighted in green
- Click any question number to jump
- Previous/Next navigation buttons
- Timer countdown (if enabled)
- Auto-submit on time expiry

**Navigation Prevention:**
- Browser back/forward buttons blocked during quiz
- Page refresh warning
- Ensures quiz integrity

### 📊 Progress Reports & Analytics

**Detailed Results:**
- Submission date and time
- Total time taken
- Score per round (correct/total)
- Percentage and grade (Excellent/Good/Fair/Needs Improvement)
- Visual progress bars
- Breakdown: ✓ Correct, ✗ Wrong, − Skipped

**Round Comparison:**
- Side-by-side Round 1 vs Round 2 comparison
- Performance change calculation
- Same topics detection
- Improvement insights:
  - "🎉 Great improvement!" (if Round 2 > Round 1)
  - "📚 The book helped!" (if Round 2 < Round 1)
  - "✓ Consistent performance" (if equal)

**Historical Reports:**
- View all past quiz attempts
- Sorted by date (newest first)
- Average score badges (color-coded)
- Quick access to detailed breakdowns
- Stored locally in browser

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Local web server (for CORS compliance)

### Installation & Setup

1. **Clone or download the project**

2. **Start a local server:**

   **Option 1: VS Code Live Server**
   ```
   - Install "Live Server" extension
   - Right-click index.html → "Open with Live Server"
   ```

   **Option 2: Python**
   ```bash
   python -m http.server
   # Open http://localhost:8000
   ```

   **Option 3: Node.js**
   ```bash
   npx http-server .
   # Open the provided URL
   ```

3. **Upload sample question papers:**
   - Open `upload-sample-data.html` in browser
   - Click "Upload Sample Data" button
   - Wait for confirmation
   - Refresh main app

4. **Start using the app:**
   - Browse quizzes (no login needed)
   - Login to create custom quizzes
   - Take quizzes and view results

## 🗄️ Data Storage

### Firestore (Cloud Database)
**Stored:**
- Quiz configurations (created by authenticated users)
- Question papers with questions and correct answers
- Creator information and timestamps

**Collections:**
- `quizzes` - All quiz configurations
- `questionpapers` / `QuestionPapers` - Question banks

### LocalStorage (Browser Storage)
**Stored:**
- **All quiz reports** (both authenticated and anonymous users)
- User's quiz history
- Submission records

**Key:** `quizReports`

**Why LocalStorage?**
- ✅ Works for all users (authenticated + anonymous)
- ✅ Privacy-focused (data stays on device)
- ✅ Fast access, no network calls
- ✅ No database costs
- ✅ Offline access to reports

## 📋 Data Structures

### Quiz Configuration (Firestore)
```javascript
{
  title: "Science Test - Open vs Closed Book",
  numRounds: 2,
  numQuestions: 10,
  randomQuestions: true,
  timeLimitEnabled: true,
  timeLimit: 30,
  rounds: [
    { 
      papers: ["math-algebra-grade8", "science-general-grade8"], 
      openBook: true 
    },
    { 
      papers: ["math-algebra-grade8", "science-general-grade8"], 
      openBook: false 
    }
  ],
  createdBy: "user-uid",
  createdByName: "John Doe",
  createdAt: Timestamp
}
```

### Question Paper (Firestore)
```javascript
{
  Title: "Mathematics - Basic Algebra",
  Subject: "Mathematics",
  Class: "Grade 8",
  pdfUrl: "textbook.pdf",
  questions: [
    {
      Question: "What is 2 + 2?",
      "Option 1": "3",
      "Option 2": "4",
      "Option 3": "5",
      "Option 4": "6",
      "Correct Option": "2"  // String: "1", "2", "3", or "4"
    }
  ]
}
```

### Quiz Report (LocalStorage)
```javascript
{
  quizId: "quiz-id",
  quizTitle: "Science Test",
  submittedAt: "2025-12-19T15:30:00.000Z",
  totalTime: 120,  // seconds
  rounds: [
    {
      round: 1,
      score: 8,
      total: 10,
      percentage: "80.0",
      openBook: true,
      paperIds: ["paper1", "paper2"],
      details: [
        {
          question: "What is 2+2?",
          userAns: 2,
          correct: 2,
          isCorrect: true
        }
      ]
    }
  ]
}
```

## 🔧 Firebase Configuration

The app uses Firebase for:
- **Authentication**: Google Sign-In
- **Firestore**: Quiz and question paper storage

Configuration is in `app.js`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // ...
};
```

## 📚 Question Paper Requirements

For proper scoring, question papers must include:

**Required Fields:**
- `Question` or `question` - Question text
- `Option 1`, `Option 2`, `Option 3`, `Option 4` - Answer choices
- `Correct Option` - String value: "1", "2", "3", or "4"

**Optional Fields:**
- `Title` - Paper title
- `Subject` - Subject name
- `Class` - Grade/class level
- `pdfUrl` - URL to reference PDF

## 🎯 Use Cases

### Educational Testing
- Test knowledge retention (open book vs closed book)
- Compare learning effectiveness
- Identify areas needing improvement

### Practice & Learning
- Open book mode for learning phase
- Closed book mode for testing phase
- Immediate feedback and scoring

### Assessment
- Timed assessments with auto-submit
- Multiple rounds for comprehensive testing
- Detailed performance analytics

## 🔒 Security & Privacy

- Quiz creation requires authentication
- Anonymous quiz taking supported
- Reports stored locally (privacy-focused)
- Navigation prevention during active quiz
- No personal data sent to server for reports

## 📖 Documentation

- `FEATURES.md` - Complete feature list
- `USER_PERMISSIONS.md` - User access control details
- `DEMO_GUIDE.md` - Usage guide and examples
- `UPLOAD_TO_FIREBASE.md` - Question paper upload instructions

## 🎨 UI Features

- Clean, modern interface
- Responsive design (mobile-friendly)
- Color-coded performance indicators
- Visual progress tracking
- Smooth animations
- Intuitive navigation

## 🐛 Troubleshooting

**Scoring shows 0/10:**
- Ensure question papers have "Correct Option" field
- Check console logs for field name mismatches
- Use sample data upload script to test

**PDF not loading:**
- Ensure `textbook.pdf` exists in root folder
- Check `pdfUrl` field in question paper
- Verify CORS settings on server

**Reports not saving:**
- Check browser localStorage is enabled
- Verify no browser extensions blocking storage
- Check browser console for errors

## 🤝 Contributing

To add new question papers:
1. Follow the data structure in `sample-question-papers.json`
2. Use `upload-sample-data.html` to upload
3. Or manually add to Firestore console

## 📄 License

See LICENSE file for details.

## 🙏 Acknowledgments

Built with:
- Firebase (Authentication & Firestore)
- Bootstrap 5 (UI Framework)
- PDF.js (PDF Viewing)
- Bootstrap Icons
