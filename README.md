# Tic-Tac-Toe Game - Modern Edition

A visually stunning, browser-based Tic-Tac-Toe game built with HTML, CSS, JavaScript, and Flask (Python). This project showcases modern web design principles, AI logic, and real-time multiplayer capabilities.

## Features

-   **Modern UI/UX:** Sleek dark theme with glassmorphism effects and neon glowing accents.
-   **Responsive Design:** Fully optimized for both desktop and mobile devices.
-   **Game Modes:**
    -   **Play vs Friend:** Classic local multiplayer.
    -   **Play vs AI:** Challenge the computer with three difficulty levels (Easy, Medium, Hard).
    -   **Online Multiplayer:** Create private rooms and play with friends in real-time!
-   **Smart AI:** The "Hard" difficulty uses the Minimax algorithm for unbeatable gameplay.
-   **Visual Effects:** Smooth animations, hover effects, and a celebratory confetti explosion on win!

## Installation & Setup

To play the **Online Multiplayer** mode, you need to set up the backend.

### Prerequisites
-   Python 3.x installed
-   `pip` (Python package manager)

### Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/veera-crt/Tic-Tac-Tao-Game.git
    cd Tic-Tac-Tao-Game
    ```

2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the application:**
    ```bash
    python3 app.py
    ```

4.  **Open in Browser:**
    Navigate to `http://127.0.0.1:8080`

## Technologies Used

-   **Frontend:** HTML5, CSS3 (Glassmorphism), JavaScript (ES6+), Canvas Confetti
-   **Backend:** Python, Flask, Flask-SocketIO (for real-time communication)

## AI Logic

The AI uses different strategies based on difficulty:
-   **Easy:** Makes random moves.
-   **Medium:** Tries to win or block the player; otherwise moves randomly.
-   **Hard:** Uses the **Minimax Algorithm** to ensure it never loses.

Developed by Veerapandi
