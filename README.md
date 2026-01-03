# Quiz Platform

A comprehensive multi-round quiz application with Firebase authentication, private quiz management with OTP system, open book vs closed book testing, and detailed progress tracking with downloadable results.

## 🎯 Key Features

### 🔐 User Access Control

#### Authenticated Users (Google Login)
- ✅ Create custom quizzes (saved to Firestore)
- ✅ Create **private quizzes** with OTP access control
- ✅ Generate and manage OTPs for private quizzes
- ✅ View "My Quizzes" dashboard
- ✅ Take any quiz
- ✅ View detailed results and reports
- ✅ Download results as images
- ✅ Share results via WhatsApp/social media
- ✅ Access historical reports (localStorage)

#### Anonymous Users (No Login Required)
- ✅ Browse all **public** quizzes
- ✅ Take public quizzes
- ✅ Access private quizzes with valid OTP
- ✅ View results after submission
- ✅ Download and share results
- ✅ Access past reports (localStorage)
- ❌ Cannot create quizzes
- ❌ Cannot generate OTPs

### 🔒 Private Quiz System (NEW!)

**Create Private Quizzes:**
- Toggle between Public/Private when creating quiz
- Private quizzes hidden from homepage
- Only accessible via direct URL with OTP

**OTP Management:**
- Generate unlimited 6-digit OTPs per quiz
- Single-use OTPs (marked as used after access)
- View OTP status (Active/Used)
- Share quiz URL with OTP: `?quiz=ID&otp=123456`

**Access Control:**
- Private quizzes require OTP to access
- OTP modal shown if accessed without valid OTP
- Automatic OTP verification
- Quiz owner can view all OTPs in "My Quizzes"

### 📝 Quiz Creation (Authenticated Users Only)

**Configuration Options:**
- Quiz title and description
- **Visibility**: Public or Private
- Number of rounds: 1-2
- Number of questions per quiz
- Random question order: Yes/No
- Time limit: Optional with auto-submit
- Question paper selection: Multiple papers per round

**Reference Material Options (Round 1):**
- **PDF URL**: Enter PDF filename or URL (e.g., `textbook.pdf` or `https://example.com/doc.pdf`)
- **Web Page (iframe)**: Embed any website as reference (e.g., Wikipedia, documentation)

**Round Configuration:**
- **Round 1**: Can be Open Book with PDF or webpage reference
- **Round 2**: Always Closed Book (no reference material)
- Select different or same question papers per round
- Combine multiple question papers in one round

### 🌐 URL-Based Quiz Access (NEW!)

**Direct Quiz Links:**
- Share quiz via URL: `?quiz=QUIZ_ID`
- Access private quizzes: `?quiz=QUIZ_ID&otp=123456`
- Automatic quiz loading from URL parameters
- Perfect for sharing with students

### 🎓 Quiz Taking Experience

**Multi-Round Support:**
- Up to 2 rounds per quiz
- Clear round indicators (📖 Open Book / 📕 Closed Book)
- Seamless transition between rounds

**Open Book Mode (Round 1):**
- Split-screen interface
- Questions on left, reference material on right
- **PDF Viewer**: Navigate pages, zoom, search
- **Web Page Viewer**: Embedded website with "Open in New Tab" option
- Choose reference type when creating quiz

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

**Download Results (NEW!):**
- Click "Download Result" button
- Generates professional PNG image
- Includes all scores, percentages, and progress bars
- Perfect for sharing or printing

**Share Results (NEW!):**
- Click "Share" button
- Uses native Web Share API (mobile)
- WhatsApp fallback (desktop)
- Formatted text with all scores and improvements

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
- Download or share any past result
- Stored locally in browser

### 📱 My Quizzes Dashboard (NEW!)

**For Quiz Creators:**
- View all your created quizzes
- See quiz visibility status (🔒 Private / 🌐 Public)
- Copy quiz URLs to share
- Generate OTPs for private quizzes
- View OTP status (Active/Used)
- Manage multiple OTPs per quiz

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Local web server (for CORS compliance)
- **Disable ad blockers** (they may block Firestore connections)

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
   - Browse public quizzes (no login needed)
   - Login to create custom quizzes
   - Create private quizzes with OTP
   - Take quizzes and download/share results

## 🗄️ Data Storage

### Firestore (Cloud Database)
**Stored:**
- Quiz configurations (created by authenticated users)
- Quiz visibility (public/private)
- OTPs for private quizzes (subcollection)
- Question papers with questions and correct answers
- Creator information and timestamps

**Collections:**
- `quizzes` - All quiz configurations
  - `otps` (subcollection) - OTPs for private quizzes
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
  isPrivate: false,  // NEW: true for private quizzes
  numRounds: 2,
  numQuestions: 10,
  randomQuestions: true,
  timeLimitEnabled: true,
  timeLimit: 30,
  rounds: [
    { 
      papers: ["math-algebra-grade8", "science-general-grade8"], 
      openBook: true,
      referenceConfig: {  // NEW: Reference material configuration
        type: "pdf",  // or "iframe"
        url: "textbook.pdf"  // or "https://example.com"
      }
    },
    { 
      papers: ["math-algebra-grade8", "science-general-grade8"], 
      openBook: false,
      referenceConfig: null
    }
  ],
  createdBy: "user-uid",
  createdByName: "John Doe",
  createdAt: Timestamp
}
```

### OTP Document (Firestore Subcollection)
```javascript
// Path: quizzes/{quizId}/otps/{otpId}
{
  code: "123456",  // 6-digit OTP
  used: false,  // true after first use
  createdAt: Timestamp,
  createdBy: "user-uid",
  usedAt: Timestamp  // set when used
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

**Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizzes/{quizId} {
      allow read: if true;  // All can read
      allow write: if request.auth != null;  // Only authenticated can write
      
      match /otps/{otpId} {
        allow read, write: if request.auth != null;  // Only authenticated
      }
    }
    
    match /questionpapers/{paperId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /QuestionPapers/{paperId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
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
- Private assessments with OTP control

### Practice & Learning
- Open book mode for learning phase
- Closed book mode for testing phase
- Immediate feedback and scoring
- Web-based reference materials

### Assessment
- Timed assessments with auto-submit
- Multiple rounds for comprehensive testing
- Detailed performance analytics
- Downloadable and shareable results
- Private quizzes for controlled access

### Remote Learning
- Share quiz links with students
- OTP-based access for private assessments
- Web page references (Wikipedia, documentation)
- Results sharing via WhatsApp/social media

## 🔒 Security & Privacy

- Quiz creation requires authentication
- Private quizzes with OTP protection
- Single-use OTPs prevent sharing
- Anonymous quiz taking supported
- Reports stored locally (privacy-focused)
- No personal data sent to server for reports
- Navigation prevention during active quiz

## 📖 Documentation

- `FEATURES.md` - Complete feature list with examples
- `TROUBLESHOOTING.md` - Common issues and solutions
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
- Split-screen quiz interface
- PDF and webpage viewers

## 🐛 Troubleshooting

**Firestore Connection Blocked:**
- Disable ad blocker or whitelist `firestore.googleapis.com`
- Check browser console for `ERR_BLOCKED_BY_CLIENT`
- Try incognito/private mode

**Scoring shows 0/10:**
- Ensure question papers have "Correct Option" field
- Check console logs for field name mismatches
- Use sample data upload script to test

**PDF not loading:**
- Ensure `textbook.pdf` exists in root folder
- Check `pdfUrl` field in question paper
- Verify CORS settings on server

**OTP not working:**
- Check console logs for detailed OTP verification steps
- Ensure quiz is marked as private (`isPrivate: true`)
- Verify OTP hasn't been used already

**Reports not saving:**
- Check browser localStorage is enabled
- Verify no browser extensions blocking storage
- Check browser console for errors

**My Quizzes not showing:**
- Ensure you're logged in
- Check console for Firestore query errors
- Verify quizzes have `createdBy` field

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
- Canvas API (Result image generation)
- Web Share API (Result sharing)
