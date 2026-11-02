(() => {
  const COLORS = { blue: '#5a96ff', red: '#ff616d', neutral: '#f0f1dc' };
  const PACES = {
    chill: { ball: 310, paddle: 570, cpu: 265 },
    arcade: { ball: 405, paddle: 640, cpu: 345 },
    turbo: { ball: 515, paddle: 730, cpu: 430 },
  };
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  class PongGame {
    constructor(onEvent = () => {}) {
      this.width = 1000;
      this.height = 560;
      this.goal = 11;
      this.mode = 'solo';
      this.pace = 'arcade';
      this.onEvent = onEvent;
      this.reset();
    }

    reset() {
      this.state = 'ready';
      this.scores = [0, 0];
      this.hits = { blue: 0, red: 0 };
      this.winner = null;
      this.paddles = [40, 946].map((position) => ({ x: position, y: 228, width: 14, height: 104, color: COLORS.neutral }));
      this.balls = ['blue', 'red'].map((name, index) => ({
        name, color: COLORS[name], x: index === 0 ? 250 : 750, y: index === 0 ? 185 : 375,
        radius: 9, vx: 0, vy: 0, wait: 0, trail: [],
      }));
      this.onEvent({ type: 'reset' });
    }

    start() {
      if (this.state === 'playing') return;
      if (this.state === 'paused') {
        this.state = 'playing';
        this.onEvent({ type: 'state' });
        return;
      }
      if (this.state === 'finished') this.reset();
      this.balls.forEach((ball, index) => this.serve(ball, index === 0 ? -1 : 1, index * 0.12 + 0.3));
      this.state = 'playing';
      this.onEvent({ type: 'state' });
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.onEvent({ type: 'state' });
    }

    configure(mode, pace) {
      if (!['solo', 'duo'].includes(mode) || !PACES[pace]) return;
      this.mode = mode;
      this.pace = pace;
      this.reset();
    }

    serve(ball, direction, delay = 0.65) {
      const angle = (0.23 + Math.random() * 0.32) * (ball.name === 'blue' ? 1 : -1);
      ball.x = this.width / 2;
      ball.y = this.height * (ball.name === 'blue' ? 0.33 : 0.67);
      ball.vx = Math.cos(angle) * PACES[this.pace].ball * direction;
      ball.vy = Math.sin(angle) * PACES[this.pace].ball;
      ball.wait = delay;
      ball.trail = [];
    }

    movePaddle(index, target, distance) {
      const paddle = this.paddles[index];
      const center = paddle.y + paddle.height / 2;
      paddle.y = clamp(paddle.y + clamp(target - center, -distance, distance), 18, this.height - 18 - paddle.height);
    }

    cpuTarget() {
      const approaching = this.balls.filter((ball) => ball.vx > 0 && ball.wait <= 0)
        .sort((first, second) => (946 - first.x) / first.vx - (946 - second.x) / second.vx);
      if (!approaching.length) return this.height / 2;
      const ball = approaching[0];
      const remaining = Math.max(0, (this.paddles[1].x - ball.radius - ball.x) / ball.vx);
      const minimum = 18 + ball.radius;
      const span = this.height - 36 - ball.radius * 2;
      const projection = ball.y + ball.vy * remaining - minimum;
      const folded = ((projection % (span * 2)) + span * 2) % (span * 2);
      const target = minimum + (folded > span ? span * 2 - folded : folded);
      return target + Math.sin(ball.x / 95) * 22;
    }

    step(seconds, input = {}) {
      if (this.state !== 'playing') return;
      const duration = clamp(seconds, 0, 0.05);
      const steps = Math.max(1, Math.ceil(duration / (1 / 240)));
      const delta = duration / steps;
      const speed = PACES[this.pace];
      for (let tick = 0; tick < steps && this.state === 'playing'; tick += 1) {
        const left = this.paddles[0];
        const right = this.paddles[1];
        const leftTarget = input.leftAxis ? left.y + left.height / 2 + input.leftAxis * speed.paddle : (input.leftTarget ?? left.y + left.height / 2);
        this.movePaddle(0, leftTarget, speed.paddle * delta);
        if (this.mode === 'solo') {
          this.movePaddle(1, this.cpuTarget(), speed.cpu * delta);
        } else {
          const rightTarget = input.rightAxis ? right.y + right.height / 2 + input.rightAxis * speed.paddle : (input.rightTarget ?? right.y + right.height / 2);
          this.movePaddle(1, rightTarget, speed.paddle * delta);
        }
        for (const ball of this.balls) {
          if (this.state !== 'playing') break;
          if (ball.wait > 0) {
            ball.wait = Math.max(0, ball.wait - delta);
            continue;
          }
          ball.x += ball.vx * delta;
          ball.y += ball.vy * delta;
          if (ball.y - ball.radius <= 18 && ball.vy < 0) {
            ball.y = 18 + ball.radius;
            ball.vy = Math.abs(ball.vy);
            this.onEvent({ type: 'wall', ball });
          } else if (ball.y + ball.radius >= this.height - 18 && ball.vy > 0) {
            ball.y = this.height - 18 - ball.radius;
            ball.vy = -Math.abs(ball.vy);
            this.onEvent({ type: 'wall', ball });
          }
          const index = ball.vx < 0 ? 0 : 1;
          const paddle = this.paddles[index];
          if (ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width &&
              ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height) {
            const direction = index === 0 ? 1 : -1;
            const offset = clamp((ball.y - paddle.y - paddle.height / 2) / (paddle.height / 2), -1, 1);
            const angle = offset * Math.PI / 3;
            const nextSpeed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.045, 800);
            ball.x = index === 0 ? paddle.x + paddle.width + ball.radius : paddle.x - ball.radius;
            ball.vx = Math.cos(angle) * nextSpeed * direction;
            ball.vy = Math.sin(angle) * nextSpeed;
            paddle.color = ball.color;
            this.hits[ball.name] += 1;
            this.onEvent({ type: 'hit', ball, paddle: index });
          }
          if (ball.x < -ball.radius || ball.x > this.width + ball.radius) {
            const scorer = ball.x < 0 ? 1 : 0;
            this.scores[scorer] += 1;
            if (this.scores[scorer] >= this.goal) {
              this.winner = scorer;
              this.state = 'finished';
            }
            this.serve(ball, scorer === 0 ? 1 : -1);
            this.onEvent({ type: 'score', scorer, ball });
          }
        }
      }
    }
  }

  globalThis.DoublePlay = { PongGame, COLORS };
})();
