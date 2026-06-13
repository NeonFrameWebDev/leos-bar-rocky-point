"use strict";
/* Leo's Bar hero: "Drop Anchor".
   A cinematic underwater scene on a 2D canvas. The Leo's anchor crest descends
   on a chain into deep navy water, lands with a light burst + ripple, then hangs
   glowing and swaying amid god rays, rippling caustics, rising bubbles and
   drifting marine snow. The crest is the brand logo (white line art on black)
   composited with 'screen' so the black drops out and the line art glows; a warm
   gold halo sits behind it and the moving light plays over it.

   Light + safe: one rAF loop, DPR capped 2, pauses off-screen / tab-hidden, the
   caustic texture is pre-rendered once, pointer adds a little parallax depth.
   prefers-reduced-motion -> one static settled frame, no loop. */
(function () {
  var canvas = document.getElementById("anchor-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d", { alpha: false });
  var hero = canvas.closest("#hero") || canvas.parentNode;
  var prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = 1;
  var raf = null, running = false, t0 = 0, lastT = 0, time = 0, visible = true;

  // reveal + anchor-drop spring
  var revealed = false, dropOff = 0, dropV = 0, landed = false, entered = 0, landT = -1;

  // pointer parallax (eased)
  var ptx = 0, pty = 0, px = 0, py = 0;

  // particles
  var bubbles = [], snow = [];
  var MAXBUB = 26;

  // god rays
  var rays = [];

  // caustic texture (pre-rendered, tileable)
  var causticSize = 256, caustic = null;

  // brand crest
  var logo = new Image(), logoReady = false;
  logo.onload = function () { logoReady = true; if (!running && revealed) paint(0); };
  logo.src = "assets/logo_hd.png";    // high-res vector render of the anchor crest

  // anchor geometry (computed on resize)
  var aCx = 0, aCy = 0, aSize = 0;

  // ---- build the tileable caustic interference texture -------------------
  function buildCaustic() {
    var c = document.createElement("canvas"); c.width = c.height = causticSize;
    var g = c.getContext("2d");
    var img = g.createImageData(causticSize, causticSize), d = img.data;
    var TAU = 6.28318530718;
    for (var y = 0; y < causticSize; y++) {
      for (var x = 0; x < causticSize; x++) {
        var u = x / causticSize * TAU, v = y / causticSize * TAU;
        // integer frequencies -> seamless tile; interference of gratings -> web
        var s = Math.sin(u * 2) + Math.sin(v * 2 + 1.7) +
                Math.sin((u + v) * 1 + 0.5) + Math.sin((u - v) * 3 + 2.1) +
                Math.sin((u * 2 + v) * 1 + 4.2);
        s = s / 5;                       // -1..1
        var b = Math.max(0, s);
        b = b * b * b;                   // sharp bright filaments
        var val = b * 255;
        var i = (y * causticSize + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = val; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    caustic = c;
  }

  // ---- layout / particles -------------------------------------------------
  function computeGeo() {
    // Center the crest in the clear band between the nav and the hero copy, sized
    // to fit (so it never collides with the headline on short / portrait screens).
    var content = hero.querySelector(".hero-content");
    var cTop = H * 0.6;
    if (content) {
      var hr = hero.getBoundingClientRect(), cr = content.getBoundingClientRect();
      if (cr.height) cTop = cr.top - hr.top;
    }
    var navH = Math.min(96, H * 0.12);
    var top = navH + H * 0.03;
    var bot = cTop - H * 0.025;
    if (bot < top + 80) bot = top + 80;     // floor on very short heroes
    var bandH = bot - top;
    var EFF = 0.42;                          // crest ink half-extent / aSize
    aCx = W * 0.5;
    aSize = Math.min(W * 0.62, bandH / (2 * EFF) * 0.96, 380);
    aCy = (top + bot) / 2;
  }

  function makeRays() {
    rays = [];
    var n = W < 700 ? 4 : 6;
    for (var i = 0; i < n; i++) {
      rays.push({
        x: (i + 0.5) / n + (Math.random() - 0.5) * 0.12, // 0..1 across top
        w: 0.06 + Math.random() * 0.10,                  // width fraction
        a: 0.05 + Math.random() * 0.07,                  // alpha
        sw: 0.3 + Math.random() * 0.6,                   // sway speed
        ph: Math.random() * 6.283,
        skew: (Math.random() - 0.5) * 0.5                // lean
      });
    }
  }

  function seedSnow() {
    snow = [];
    var n = Math.round(Math.min(60, W / 16));
    for (var i = 0; i < n; i++) {
      snow.push({ x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.7,
        vy: 4 + Math.random() * 12, drift: Math.random() * 6.283, dp: 0.2 + Math.random() * 0.9,
        a: 0.12 + Math.random() * 0.30, depth: 0.3 + Math.random() * 0.7 });
    }
  }

  function spawnBubble() {
    bubbles.push({ x: aCx + (Math.random() - 0.5) * aSize * 0.9, y: H + 6,
      r: 1.2 + Math.random() * 4.2, sp: 26 + Math.random() * 60, ph: Math.random() * 6.283,
      w: 0.4 + Math.random() * 1.4, a: 0.18 + Math.random() * 0.34 });
  }

  // ---- sizing -------------------------------------------------------------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || hero.clientWidth;
    H = canvas.clientHeight || hero.clientHeight;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeGeo(); makeRays(); seedSnow();
    if (!caustic) buildCaustic();
    if (!running) { if (prefersReduce) renderStatic(); else paint(0); }
  }

  // ---- simulation ---------------------------------------------------------
  function step(dt) {
    px += (ptx - px) * Math.min(1, dt * 3);
    py += (pty - py) * Math.min(1, dt * 3);

    if (revealed) {
      entered += (1 - entered) * Math.min(1, dt * 7);
      if (!landed) {
        // a real, visible fall: gravity accelerates the crest down on its chain
        dropV += 1500 * dt;
        dropOff += dropV * dt;
        if (dropOff >= 0) { dropOff = 0; dropV = -dropV * 0.26; landed = true; landT = time; }
      } else {
        // chain-yank settle: a small rebound that damps out into the idle sway
        dropV += (-dropOff * 130 - dropV * 9) * dt;
        dropOff += dropV * dt;
      }
    }

    // bubbles
    if (bubbles.length < MAXBUB && Math.random() < dt * (entered > 0.5 ? 22 : 8)) spawnBubble();
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i]; b.sp += 10 * dt; b.y -= b.sp * dt;
      b.x += Math.sin(time * 2 + b.ph) * b.w;
      if (b.y < -8) bubbles.splice(i, 1);
    }
    // marine snow
    for (i = 0; i < snow.length; i++) {
      var s = snow[i]; s.y += s.vy * dt; s.x += Math.sin(time * s.dp + s.drift) * 4 * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  // ---- render -------------------------------------------------------------
  function drawWater() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a3a59");      // surface-lit navy
    g.addColorStop(0.42, "#102a44");
    g.addColorStop(1, "#060f1c");                                 // depths (text sits here)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // warm surface glow up top
    var gg = ctx.createRadialGradient(W * 0.5, -H * 0.12, H * 0.05, W * 0.5, -H * 0.12, H * 0.9);
    gg.addColorStop(0, "rgba(120,180,210,0.20)"); gg.addColorStop(1, "rgba(120,180,210,0)");
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  }

  function drawRays() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < rays.length; i++) {
      var r = rays[i];
      var cx = (r.x + px * 0.04 + Math.sin(time * r.sw + r.ph) * 0.03) * W;
      var topW = r.w * W * 0.18, botW = r.w * W;
      var lean = r.skew * W * 0.16 + px * W * 0.03;
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(255,240,205," + r.a.toFixed(3) + ")");
      g.addColorStop(0.55, "rgba(255,236,195," + (r.a * 0.4).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,236,195,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - topW, -2); ctx.lineTo(cx + topW, -2);
      ctx.lineTo(cx + botW + lean, H + 2); ctx.lineTo(cx - botW + lean, H + 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawCaustics() {
    if (!caustic) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // two scrolling layers at different scale/speed, masked brighter near the surface
    var layers = [
      { sc: H * 0.85, sx: time * 9, sy: time * 5, a: 0.5 },
      { sc: H * 1.5, sx: -time * 5, sy: time * 8, a: 0.34 }
    ];
    for (var l = 0; l < layers.length; l++) {
      var L = layers[l], sc = L.sc;
      ctx.globalAlpha = L.a;
      var ox = ((L.sx % sc) + sc) % sc, oy = ((L.sy % sc) + sc) % sc;
      for (var yy = -oy; yy < H; yy += sc) {
        for (var xx = -ox; xx < W; xx += sc) {
          ctx.drawImage(caustic, xx, yy, sc, sc);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // fade caustics out toward the bottom (keep depths dark for text)
    var fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, "rgba(6,15,28,0)"); fade.addColorStop(0.55, "rgba(6,15,28,0)");
    fade.addColorStop(1, "rgba(6,15,28,0.92)");
    ctx.fillStyle = fade; ctx.fillRect(0, 0, W, H);
  }

  function drawSnow() {
    for (var i = 0; i < snow.length; i++) {
      var s = snow[i], x = s.x + px * 18 * s.depth, y = s.y + py * 10 * s.depth;
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.2832);
      ctx.fillStyle = "rgba(210,228,240," + (s.a * s.depth).toFixed(3) + ")"; ctx.fill();
    }
  }

  function drawBubbles() {
    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i], x = b.x + px * 10;
      ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.2832);
      ctx.strokeStyle = "rgba(200,225,240," + b.a.toFixed(3) + ")"; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.34, 0, 6.2832);
      ctx.fillStyle = "rgba(235,245,252," + (b.a * 1.3).toFixed(3) + ")"; ctx.fill();
    }
  }

  function drawChain(topY, anchorTopY, swayX) {
    // a swaying chain from the top of frame down to the anchor's ring
    var links = Math.max(4, Math.round((anchorTopY - topY) / (aSize * 0.10)));
    if (links < 1) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, aSize * 0.018);
    for (var i = 0; i <= links; i++) {
      var t = i / links;
      var y = topY + (anchorTopY - topY) * t;
      var x = W * 0.5 + px * 8 + Math.sin(time * 0.8 + t * 2) * swayX * t;
      var rx = aSize * 0.034, ry = aSize * 0.05;
      ctx.beginPath();
      ctx.ellipse(x, y, (i % 2 ? rx * 0.6 : rx), ry, 0, 0, 6.2832);
      ctx.strokeStyle = "rgba(225,212,170," + (0.30 * entered).toFixed(3) + ")";
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAnchor() {
    if (!logoReady) return;
    var bob = landed ? Math.sin(time * 0.9) * (aSize * 0.012) : 0;
    var rot = landed ? Math.sin(time * 0.6 + 1) * 0.018 : 0;
    var cx = aCx + px * 10;
    var cy = aCy + dropOff + bob;
    var sway = aSize * 0.05;

    // chain holding it up
    drawChain(-4, cy - aSize * 0.5, sway);

    // warm gold halo behind the crest (depth glow)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var halo = ctx.createRadialGradient(cx, cy, aSize * 0.05, cx, cy, aSize * 0.72);
    var ha = (0.22 + (landed ? 0.10 * (0.5 + 0.5 * Math.sin(time * 0.9)) : 0)) * entered;
    halo.addColorStop(0, "rgba(240,196,96," + ha.toFixed(3) + ")");
    halo.addColorStop(0.5, "rgba(210,150,70," + (ha * 0.5).toFixed(3) + ")");
    halo.addColorStop(1, "rgba(210,150,70,0)");
    ctx.fillStyle = halo; ctx.fillRect(cx - aSize, cy - aSize, aSize * 2, aSize * 2);
    ctx.restore();

    // the crest: 'screen' drops the black bg, the white line art glows
    ctx.save();
    ctx.globalAlpha = Math.min(1, entered * 1.1);
    ctx.globalCompositeOperation = "screen";
    ctx.translate(cx, cy); ctx.rotate(rot);
    var w = aSize, h = aSize; // logo.jpg is square
    ctx.drawImage(logo, -w / 2, -h / 2, w, h);
    // a soft second pass for a warm bloom on the lines
    ctx.globalAlpha = 0.30 * entered;
    ctx.drawImage(logo, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    ctx.restore();

    // landing light burst + ripple
    if (landed && landT >= 0) {
      var lt = time - landT;
      if (lt < 1.1) {
        var k = lt / 1.1;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // flash
        var fa = (1 - k) * 0.5;
        var fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, aSize * (0.4 + k * 1.2));
        fg.addColorStop(0, "rgba(255,244,210," + (fa * 0.8).toFixed(3) + ")");
        fg.addColorStop(1, "rgba(255,244,210,0)");
        ctx.fillStyle = fg; ctx.fillRect(cx - aSize * 2, cy - aSize * 2, aSize * 4, aSize * 4);
        // expanding ring
        ctx.globalAlpha = (1 - k) * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy + aSize * 0.1, aSize * (0.3 + k * 1.4), aSize * (0.12 + k * 0.5), 0, 0, 6.2832);
        ctx.lineWidth = Math.max(1, aSize * 0.012 * (1 - k));
        ctx.strokeStyle = "rgba(255,240,205," + ((1 - k) * 0.7).toFixed(3) + ")";
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function vignette() {
    var g = ctx.createRadialGradient(W * 0.5, H * 0.42, H * 0.2, W * 0.5, H * 0.6, H * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(2,8,16,0.55)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function paint(dt) {
    drawWater();
    drawRays();
    drawCaustics();
    drawSnow();
    drawAnchor();   // chain + halo + crest + burst
    drawBubbles();
    vignette();
  }

  function frame(now) {
    if (!running) return;
    if (!t0) { t0 = now; lastT = now; }
    time = (now - t0) / 1000;
    var dt = (now - lastT) / 1000; lastT = now; if (dt > 0.05) dt = 0.05;
    step(dt); paint(dt);
    raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    revealed = true; entered = 1; dropOff = 0; dropV = 0; landed = true; landT = -10; time = 0.0;
    bubbles = []; for (var i = 0; i < 10; i++) spawnBubble(), bubbles[i].y = Math.random() * H;
    paint(0);
  }

  function start() { if (running || prefersReduce) return; running = true; t0 = 0; lastT = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  // begin the drop once the page loader has cleared
  function whenRevealed(cb) {
    var loader = document.getElementById("loader");
    if (!loader) { cb(); return; }
    var done = false, ticks = 0;
    (function check() {
      if (done) return;
      var cs = window.getComputedStyle(loader);
      if (!document.body.contains(loader) || cs.display === "none" || cs.visibility === "hidden" ||
          parseFloat(cs.opacity) < 0.05 || loader.offsetParent === null) { done = true; cb(); return; }
      if (++ticks > 150) { done = true; cb(); return; }   // ~2.5s safety fallback
      requestAnimationFrame(check);
    })();
  }

  function beginDrop() {
    revealed = true; landed = false; landT = -1;
    dropOff = -(aCy + aSize);        // start just above the top of the frame
    dropV = 0; entered = 0;
  }

  // ---- inputs / lifecycle -------------------------------------------------
  if (!prefersReduce) {
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      ptx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });
    hero.addEventListener("mouseleave", function () { ptx = 0; pty = 0; }, { passive: true });
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null && e.beta == null) return;
      ptx = Math.max(-1, Math.min(1, (e.gamma || 0) / 30));
      pty = Math.max(-1, Math.min(1, ((e.beta || 0) - 45) / 40));
    }, { passive: true });
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else if (visible && !prefersReduce) start(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) {
      visible = ents[0].isIntersecting;
      if (visible && !document.hidden && !prefersReduce) start(); else stop();
    }, { threshold: 0.02 }).observe(hero);
  }

  resize();
  if (prefersReduce) { renderStatic(); }
  else { paint(0); start(); whenRevealed(beginDrop); }
})();
