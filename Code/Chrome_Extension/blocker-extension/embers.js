// 火星/灰烬粒子动画（从 index.html 内联脚本抽出，符合 MV3 CSP 要求）
const canvas = document.getElementById('embers');
const ctx = canvas.getContext('2d');
let W, H, particles = [];
const COUNT = 40;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function spawn(init) {
  return {
    x: Math.random() * W,
    y: init ? Math.random() * H : H + 10,
    r: Math.random() * 1.6 + 0.4,
    vy: -(Math.random() * 0.4 + 0.15),
    vx: (Math.random() - 0.5) * 0.2,
    life: Math.random(),
    hue: Math.random() < 0.7 ? 35 : 0  // 暖金为主，少量猩红
  };
}
for (let i = 0; i < COUNT; i++) particles.push(spawn(true));

function tick() {
  ctx.clearRect(0, 0, W, H);
  for (const p of particles) {
    p.y += p.vy;
    p.x += p.vx + Math.sin(p.y * 0.01) * 0.15;
    p.life -= 0.003;
    if (p.y < -10 || p.life <= 0) Object.assign(p, spawn(false));

    const alpha = Math.max(0, Math.min(1, p.life)) * 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.hue === 35
      ? `rgba(232, 176, 75, ${alpha})`
      : `rgba(217, 68, 54, ${alpha})`;
    ctx.fill();
  }
  requestAnimationFrame(tick);
}
tick();

// 光晕跟随鼠标一点点，不抢戏
const glow = document.querySelector('.glow');
window.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  glow.style.transform = `translate(${x}px, ${y}px)`;
});
