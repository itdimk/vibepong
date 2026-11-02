(() => {
  const { PongGame } = globalThis.DoublePlay;
  const byId = (name) => document.getElementById(name);
  const canvas = byId('court');
  const context = canvas.getContext('2d');
  const keys = new Set();
  const pointers = new Map();
  const targets = { leftTarget: null, rightTarget: null };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const particles = [];
  let audioContext;
  let soundEnabled = false;
  let previousTime = 0;
  let trailClock = 0;
  let game;

  function tone(frequency, duration, volume = 0.06) {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, audioContext.currentTime + duration);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function syncScore() {
    byId('left-score').textContent = String(game.scores[0]).padStart(2, '0');
    byId('right-score').textContent = String(game.scores[1]).padStart(2, '0');
    byId('left-swatch').style.background = game.paddles[0].color;
    byId('right-swatch').style.background = game.paddles[1].color;
    byId('blue-hits').textContent = game.hits.blue;
    byId('red-hits').textContent = game.hits.red;
  }

  function syncInterface() {
    if (!game) return;
    syncScore();
    const playing = game.state === 'playing';
    const paused = game.state === 'paused';
    const finished = game.state === 'finished';
    const duo = game.mode === 'duo';
    byId('game-overlay').hidden = playing;
    byId('pause-button').disabled = game.state === 'ready' || finished;
    byId('pause-button').textContent = paused ? '▷ RESUME' : 'Ⅱ PAUSE';
    byId('status-dot').classList.toggle('is-live', playing);
    byId('left-name').textContent = duo ? 'PLAYER 01' : 'YOU';
    byId('right-name').textContent = duo ? 'PLAYER 02' : 'COMPUTER';
    byId('match-state').textContent = playing ? 'MATCH IN PLAY' : paused ? 'ON A BREAK' : finished ? 'THAT’S A MATCH' : 'READY TO RALLY';
    byId('status-label').textContent = playing ? 'TWO BALLS. BOTH LIVE.' : paused ? 'TAKE YOUR TIME' : finished ? 'ANOTHER ROUND?' : 'THE COURT IS YOURS';
    byId('overlay-eyebrow').textContent = paused ? 'TIME OUT' : finished ? 'GOOD GAME. GREAT COLORS.' : 'NOT YOUR AVERAGE PONG';
    byId('overlay-title').innerHTML = paused ? 'Catch your<br>breath.' : finished ? (duo ? `Player ${game.winner === 0 ? '01' : '02'}<br>takes it.` : game.winner === 0 ? 'Color you<br>a winner.' : 'The CPU<br>takes it.') : 'One paddle.<br>Two problems.';
    byId('overlay-description').innerHTML = paused ? 'Both balls are right where you left them.<br>Ready when you are.' : finished ? `${game.scores[0]} — ${game.scores[1]}<br>Same court. Fresh start. Rematch?` : 'Keep both balls in play.<br>Your paddle wears the color of your last hit.';
    byId('play-label').textContent = paused ? 'BACK TO IT' : finished ? 'PLAY AGAIN' : 'LET’S PLAY';
    byId('overlay-hint').innerHTML = `or press <kbd>SPACE</kbd> to ${paused ? 'resume' : finished ? 'play again' : 'start'}`;
    byId('movement-title').textContent = duo ? 'PLAYER 01 · LEFT' : 'MOVE YOUR PADDLE';
    byId('movement-keys').innerHTML = duo ? '<kbd>W</kbd><kbd>S</kbd><span class="or">or touch left court</span>' : '<kbd>W</kbd><kbd>S</kbd><span class="or">or</span><kbd>↑</kbd><kbd>↓</kbd><span class="or">or mouse / touch</span>';
    byId('secondary-controls').innerHTML = duo ? '<span class="control-title">PLAYER 02 · RIGHT</span><span><kbd>↑</kbd><kbd>↓</kbd><span class="or">or touch right court · Space pauses</span></span>' : '<span class="control-title">TAKE A BREATHER</span><span><kbd>SPACE</kbd><span class="or">to pause / resume</span></span>';
    canvas.setAttribute('aria-label', duo ? 'Two-player Pong. Player one uses W and S. Player two uses arrow keys. On touchscreens, drag your half of the court. Space pauses.' : 'Two-ball Pong. Move your paddle with W and S, arrow keys, the mouse, or touch. Space starts or pauses.');
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const selected = button.dataset.mode === game.mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-pace]').forEach((button) => {
      const selected = button.dataset.pace === game.pace;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    byId('pace-description').textContent = {
      chill: 'A gentler rally. Find your rhythm, keep your cool.',
      arcade: 'The sweet spot. A little chaos, a lot of fun.',
      turbo: 'Fast balls. Quick hands. No time to blink.',
    }[game.pace];
  }

  function onGameEvent(event) {
    if (event.type === 'hit') {
      syncScore();
      tone(event.ball.name === 'blue' ? 520 : 740, 0.09);
      if (!reducedMotion.matches) {
        for (let index = 0; index < 9; index += 1) {
          particles.push({ x: event.ball.x, y: event.ball.y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.36, color: event.ball.color });
        }
      }
    } else if (event.type === 'wall') {
      tone(260, 0.05, 0.018);
    } else {
      if (event.type === 'reset') {
        particles.length = 0;
        targets.leftTarget = null;
        targets.rightTarget = null;
        keys.clear();
        pointers.clear();
      }
      syncInterface();
      if (event.type === 'score') {
        tone(game.state === 'finished' ? 880 : 190, 0.22, 0.08);
        byId('announcer').textContent = `${game.mode === 'duo' ? 'Player one' : 'You'} ${game.scores[0]}, ${game.mode === 'duo' ? 'player two' : 'computer'} ${game.scores[1]}.${game.state === 'finished' ? ` ${game.winner === 0 ? 'Left player' : 'Right player'} wins. Press Space for a rematch.` : ''}`;
      }
    }
  }

  game = new PongGame(onGameEvent);

  function roundRectangle(positionX, positionY, width, height, radius, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(positionX, positionY, width, height, radius);
    context.fill();
  }

  function render(delta) {
    const scaleX = canvas.width / game.width;
    const scaleY = canvas.height / game.height;
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.clearRect(0, 0, game.width, game.height);
    const background = context.createRadialGradient(500, 280, 20, 500, 280, 640);
    background.addColorStop(0, '#1c3020');
    background.addColorStop(1, '#101c15');
    context.fillStyle = background;
    context.fillRect(0, 0, 1000, 560);
    context.strokeStyle = '#a7b77d08';
    context.lineWidth = 1;
    context.beginPath();
    for (let column = 0; column < 1000; column += 40) { context.moveTo(column, 0); context.lineTo(column, 560); }
    for (let row = 0; row < 560; row += 40) { context.moveTo(0, row); context.lineTo(1000, row); }
    context.stroke();
    context.strokeStyle = '#647f4540';
    context.strokeRect(18, 18, 964, 524);
    context.setLineDash([5, 12]);
    context.beginPath();
    context.moveTo(500, 18);
    context.lineTo(500, 542);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = '#637e4528';
    context.beginPath();
    context.arc(500, 280, 82, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#819b5433';
    context.beginPath();
    context.arc(500, 280, 3, 0, Math.PI * 2);
    context.fill();
    for (const paddle of game.paddles) {
      context.shadowBlur = reducedMotion.matches ? 0 : 18;
      context.shadowColor = `${paddle.color}70`;
      roundRectangle(paddle.x, paddle.y, paddle.width, paddle.height, 6, paddle.color);
      context.shadowBlur = 0;
      roundRectangle(paddle.x + 4, paddle.y + 13, 2, paddle.height - 26, 1, '#ffffff35');
    }
    trailClock += game.state === 'playing' ? delta : 0;
    const recordTrail = trailClock >= 1 / 60;
    if (recordTrail) trailClock = 0;
    const aspectCorrection = scaleX / scaleY;
    for (const ball of game.balls) {
      if (recordTrail && !reducedMotion.matches) {
        ball.trail.unshift({ x: ball.x, y: ball.y });
        if (ball.trail.length > 12) ball.trail.pop();
      }
      if (!reducedMotion.matches) {
        ball.trail.forEach((point, index) => {
          context.globalAlpha = (1 - index / 12) * 0.22;
          context.fillStyle = ball.color;
          context.beginPath();
          context.ellipse(point.x, point.y, ball.radius * (1 - index / 15), ball.radius * (1 - index / 15) * aspectCorrection, 0, 0, Math.PI * 2);
          context.fill();
        });
      }
      context.globalAlpha = 1;
      context.shadowBlur = reducedMotion.matches ? 0 : 24;
      context.shadowColor = ball.color;
      context.fillStyle = ball.color;
      context.beginPath();
      context.ellipse(ball.x, ball.y, ball.radius, ball.radius * aspectCorrection, 0, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = '#ffffff75';
      context.beginPath();
      context.ellipse(ball.x - 2, ball.y - 2 * aspectCorrection, 2.5, 2.5 * aspectCorrection, 0, 0, Math.PI * 2);
      context.fill();
      if (ball.wait > 0 && game.state === 'playing') {
        context.strokeStyle = `${ball.color}70`;
        context.lineWidth = 1;
        context.beginPath();
        context.ellipse(ball.x, ball.y, 17, 17 * aspectCorrection, 0, 0, Math.PI * 2);
        context.stroke();
      }
    }
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      if (game.state === 'playing') {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
      }
      if (particle.life <= 0) { particles.splice(index, 1); continue; }
      context.globalAlpha = Math.max(0, particle.life / 0.36);
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, 3, 3 * aspectCorrection);
    }
    context.globalAlpha = 1;
  }

  function frame(time) {
    const delta = Math.min((time - (previousTime || time)) / 1000, 0.05);
    previousTime = time;
    const leftUp = keys.has('KeyW') || (game.mode === 'solo' && keys.has('ArrowUp'));
    const leftDown = keys.has('KeyS') || (game.mode === 'solo' && keys.has('ArrowDown'));
    game.step(delta, { ...targets, leftAxis: Number(leftDown) - Number(leftUp), rightAxis: Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp')) });
    render(delta);
    requestAnimationFrame(frame);
  }

  function resize() {
    const rectangle = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rectangle.width * pixelRatio);
    canvas.height = Math.round(rectangle.height * pixelRatio);
    render(0);
  }

  function togglePlay() {
    if (game.state === 'playing') game.pause();
    else game.start();
    if (game.state === 'playing') canvas.focus({ preventScroll: true });
  }

  byId('play-button').addEventListener('click', togglePlay);
  byId('pause-button').addEventListener('click', togglePlay);
  byId('restart-button').addEventListener('click', () => game.reset());
  byId('sound-toggle').addEventListener('click', async () => {
    try {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) throw new Error('Web Audio is not supported');
      audioContext ??= new AudioEngine();
      await audioContext.resume();
      soundEnabled = !soundEnabled;
      byId('sound-label').textContent = soundEnabled ? 'ON' : 'OFF';
      byId('sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
      tone(620, 0.1);
    } catch {
      byId('announcer').textContent = 'Sound is unavailable in this browser. You can still play with sound off.';
    }
  });
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.mode !== game.mode) game.configure(button.dataset.mode, game.pace);
  }));
  document.querySelectorAll('[data-pace]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.pace !== game.pace) game.configure(game.mode, button.dataset.pace);
  }));
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.code === 'Space') {
      if (event.target.closest('button, a')) return;
      event.preventDefault();
      if (!event.repeat) togglePlay();
    } else if (event.code === 'Escape') {
      game.pause();
    } else if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      if (event.code === 'KeyW' || event.code === 'KeyS' || game.mode === 'solo') targets.leftTarget = null;
      else targets.rightTarget = null;
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));

  function pointerPosition(event) {
    const rectangle = canvas.getBoundingClientRect();
    const target = (event.clientY - rectangle.top) / rectangle.height * game.height;
    const side = pointers.get(event.pointerId) ?? (game.mode === 'duo' && event.clientX > rectangle.left + rectangle.width / 2 ? 'rightTarget' : 'leftTarget');
    targets[side] = target;
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    const rectangle = canvas.getBoundingClientRect();
    pointers.set(event.pointerId, game.mode === 'duo' && event.clientX > rectangle.left + rectangle.width / 2 ? 'rightTarget' : 'leftTarget');
    canvas.setPointerCapture(event.pointerId);
    pointerPosition(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' || pointers.has(event.pointerId)) pointerPosition(event);
  });
  function releasePointer(event) {
    const side = pointers.get(event.pointerId);
    if (side) targets[side] = null;
    pointers.delete(event.pointerId);
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);

  function pauseOnLeave() {
    keys.clear();
    pointers.clear();
    targets.leftTarget = null;
    targets.rightTarget = null;
    game.pause();
  }
  window.addEventListener('blur', pauseOnLeave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); });
  new ResizeObserver(resize).observe(canvas);
  syncInterface();
  resize();
  requestAnimationFrame(frame);
})();
