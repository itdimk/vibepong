# Double Play

A zero-dependency Pong web app with **two simultaneous balls: one blue and one red**. Every paddle hit changes that paddle to the ball’s exact color. Each ball scores independently; the first player to 11 wins.

## Play

Open `index.html` directly in a modern browser, or serve this folder:

```sh
cd /home/itdimk/Documents/Codex/2026-11-02/wha-2/outputs/gta
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:5173>.

- **Solo:** move with W / S, ↑ / ↓, your mouse, or drag on the court.
- **Two players:** left player uses W / S; right player uses ↑ / ↓. Touchscreen players can drag their respective halves simultaneously.
- **Space:** start, pause, resume, or play again. **Escape:** pause.
- Choose **Chill**, **Arcade**, or **Turbo**. Changing mode or pace resets the match.
- Sound is optional and off by default. The game pauses when you switch tabs or windows.

## Files

- `index.html`: accessible page structure, settings, and scoreboard.
- `styles.css`: responsive court and interface; respects reduced-motion preferences.
- `engine.js`: ball physics, color-changing paddles, scoring, and CPU opponent.
- `app.js`: canvas rendering, input, audio, and interface state.

No install, build step, external fonts, libraries, or network requests are needed.
