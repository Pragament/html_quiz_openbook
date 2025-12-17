# Interactive Open Book Quiz

A premium open-book quiz application integrated with Firebase.

## Features
- **Paper Selection**: Browse available question papers dynamically fetched from Firebase.
- **Split-View Interface**: View the quiz questions and the textbook PDF side-by-side.
- **Real-time Progress**: Track your learning progress with visual indicators.
- **Premium UI**: Designed with glassmorphism and modern aesthetics.

## How to Run

Since modern browsers enforce security policies (CORS) that may block loading local PDF files or scripts when opening `index.html` directly, it is recommended to run a local server.

### Option 1: Using VS Code Live Server
1. Install the "Live Server" extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

### Option 2: Using Python
If you have Python installed:
```bash
python -m http.server
```
Then open `http://localhost:8000`.

### Option 3: Using Node.js
```bash
npx http-server .
```
Then open the provided URL.

## Configuration
Firebase configuration is managed in `app.js`.
