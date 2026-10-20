/* CPR Trainer — logik teras (pengesanan kompresi, sesi, maklum balas).
 * Port daripada cpr_trainer.py. Tiada kebergantungan; boleh diuji dengan Node. */
(function (root) {
  "use strict";

  const T = {
    RATE_MIN: 100, RATE_MAX: 120,
    DEPTH_MIN: 5.0, DEPTH_MAX: 6.0,
    ELBOW_MIN: 160,
    RECOIL_MIN: 0.85,
    PAUSE_S: 2.0,
    MIN_INTERVAL_S: 0.3,
    CYCLE: 30,
    BPM: 110,
  };

  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const percentile = (a, p) => {
    const s = [...a].sort((x, y) => x - y), i = (s.length - 1) * p / 100, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  const pushCap = (arr, v, cap) => { arr.push(v); if (arr.length > cap) arr.shift(); };

  function jointAngle(a, b, c) {
    const bax = a.x - b.x, bay = a.y - b.y, bcx = c.x - b.x, bcy = c.y - b.y;
    const d = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
    if (d < 1e-6) return null;
    const cos = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / d));
    return Math.acos(cos) * 180 / Math.PI;
  }

  /* Kedudukan-Y pergelangan tangan → kompresi. Paksi-Y ke bawah: tekan = y naik. */
  class CompressionDetector {
    constructor(alpha = 0.8) { this.alpha = alpha; this.reset(); }
    reset() {
      this.ema = null; this.state = "down"; this.extY = null; this.extT = null;
      this.lastTopY = null; this.pending = null;
      this.bottomTimes = []; this.tops = []; this.rest = [];
    }
    update(t, y, thr) {
      const ev = [];
      this.ema = this.ema === null ? y : this.alpha * y + (1 - this.alpha) * this.ema;
      y = this.ema;
      if (!this.bottomTimes.length) pushCap(this.rest, y, 60);
      if (this.extY === null) { this.extY = y; this.extT = t; this.lastTopY = y; this.tops.push(y); return ev; }

      if (this.state === "down") {
        if (y > this.extY) { this.extY = y; this.extT = t; }
        else if (this.extY - y > thr) {
          const bottomY = this.extY, depthPx = bottomY - this.lastTopY;
          const last = this.bottomTimes[this.bottomTimes.length - 1];
          const tooSoon = last !== undefined && this.extT - last < T.MIN_INTERVAL_S;
          if (depthPx > 2 * thr && !tooSoon) {
            pushCap(this.bottomTimes, this.extT, 7);
            this.pending = { t: this.extT, bottomY, depthPx };
            ev.push(["compression", { ...this.pending }]);
          }
          this.state = "up"; this.extY = y; this.extT = t;
        }
      } else {
        if (y < this.extY) { this.extY = y; this.extT = t; }
        else if (y - this.extY > thr) {
          const topY = this.extY;
          if (this.pending) {
            let ref = percentile(this.tops, 10);
            if (this.rest.length >= 10) ref = Math.min(ref, median(this.rest));
            const ratio = (this.pending.bottomY - topY) / Math.max(this.pending.bottomY - ref, 1e-6);
            ev.push(["recoil", { t: this.extT, ratio }]);
            this.pending = null;
          }
          this.lastTopY = topY; pushCap(this.tops, topY, 60);
          this.state = "down"; this.extY = y; this.extT = t;
        }
      }
      return ev;
    }
    rate(now) {
      const b = this.bottomTimes;
      if (b.length < 2 || now - b[b.length - 1] > T.PAUSE_S) return 0;
      const gaps = []; for (let i = 1; i < b.length; i++) { const g = b[i] - b[i - 1]; if (g <= T.PAUSE_S) gaps.push(g); }
      return gaps.length ? 60 / mean(gaps) : 0;
    }
  }

  class Session {
    constructor() { this.reset(); }
    reset() { this.records = []; this.cycles = []; this.cycleCount = 0; this.startT = null; this.lastT = null; this.active = 0; }
    addCompression(t, depthCm, rate, elbow) {
      if (this.startT === null) this.startT = t;
      if (this.lastT !== null) {
        const gap = t - this.lastT;
        if (gap <= T.PAUSE_S) this.active += gap;
        else if (this.cycleCount) { this.cycles.push(this.cycleCount); this.cycleCount = 0; }
      }
      this.lastT = t; this.cycleCount++;
      this.records.push({ t: +(t - this.startT).toFixed(3), depth: +depthCm.toFixed(2), rate: +rate.toFixed(1), elbow: elbow == null ? null : +elbow.toFixed(1), recoil: null });
    }
    addRecoil(r) { for (let i = this.records.length - 1; i >= 0; i--) if (this.records[i].recoil === null) { this.records[i].recoil = +r.toFixed(3); break; } }
    checkPause(now) { if (this.cycleCount && this.lastT !== null && now - this.lastT > T.PAUSE_S) { this.cycles.push(this.cycleCount); this.cycleCount = 0; } }
    summary(endT) {
      const R = this.records, n = R.length; if (!n) return null;
      const cycles = this.cycles.concat(this.cycleCount ? [this.cycleCount] : []);
      const rates = R.map(r => r.rate).filter(x => x > 0), depths = R.map(r => r.depth);
      const recoils = R.map(r => r.recoil).filter(x => x !== null), elbows = R.map(r => r.elbow).filter(x => x !== null);
      const pct = (xs, f) => xs.length ? +(100 * xs.filter(f).length / xs.length).toFixed(1) : null;
      const dur = Math.max(endT - (this.startT ?? endT), 1e-6);
      const s = {
        date: new Date().toISOString(), n, duration: +dur.toFixed(1), cycles,
        rateAvg: rates.length ? +mean(rates).toFixed(1) : null,
        rateOk: pct(rates, x => x >= T.RATE_MIN && x <= T.RATE_MAX),
        rateSlow: pct(rates, x => x < T.RATE_MIN), rateFast: pct(rates, x => x > T.RATE_MAX),
        depthAvg: +mean(depths).toFixed(2),
        depthOk: pct(depths, x => x >= T.DEPTH_MIN && x <= T.DEPTH_MAX),
        depthShallow: pct(depths, x => x < T.DEPTH_MIN), depthDeep: pct(depths, x => x > T.DEPTH_MAX),
        recoilOk: pct(recoils, x => x >= T.RECOIL_MIN),
        elbowOk: pct(elbows, x => x >= T.ELBOW_MIN),
        fraction: +(100 * Math.min(this.active / dur, 1)).toFixed(1),
      };
      const parts = [s.rateOk, s.depthOk, s.recoilOk, s.elbowOk].filter(x => x !== null);
      s.score = parts.length ? +mean(parts).toFixed(1) : null;
      return s;
    }
  }

  /* Maklum balas masa nyata: keutamaan postur → kedalaman → kadar → recoil */
  function liveFeedback({ rate, depth, recoil, elbow }) {
    const m = [];
    if (rate <= 0) return m;
    if (elbow != null && elbow < T.ELBOW_MIN) m.push({ k: "elbow", text: "Luruskan siku" });
    if (depth != null && depth < T.DEPTH_MIN) m.push({ k: "shallow", text: "Tekan lebih dalam" });
    else if (depth != null && depth > T.DEPTH_MAX + 0.5) m.push({ k: "deep", text: "Kurangkan kedalaman" });
    if (rate < T.RATE_MIN) m.push({ k: "slow", text: "Lajukan sedikit" });
    else if (rate > T.RATE_MAX) m.push({ k: "fast", text: "Perlahankan sedikit" });
    if (recoil != null && recoil < T.RECOIL_MIN) m.push({ k: "recoil", text: "Biar dada naik penuh" });
    if (!m.length) m.push({ k: "good", text: "Bagus, kekalkan" });
    return m;
  }

  /* Ulasan akhir sesi berasaskan peraturan (berjalan dalam telefon, tanpa internet). */
  function coachReport(s) {
    const good = [], fix = [];
    if (s.rateOk >= 70) good.push(`Kadar konsisten: ${s.rateOk}% kompresi dalam julat 100–120/min.`);
    else if (s.rateSlow > s.rateFast) fix.push(`Kadar terlalu perlahan (purata ${s.rateAvg}/min). Ikut bunyi metronom dan kira kuat “satu-dan-dua-dan”.`);
    else fix.push(`Kadar terlalu laju (purata ${s.rateAvg}/min). Kompresi laju biasanya jadi cetek; ikut metronom.`);
    if (s.depthOk >= 70) good.push(`Kedalaman baik: ${s.depthOk}% dalam julat 5–6 cm.`);
    else if (s.depthShallow >= s.depthDeep) fix.push(`${s.depthShallow}% kompresi terlalu cetek. Bahu tegak di atas tangan, tekan guna berat badan, bukan kekuatan lengan.`);
    else fix.push(`${s.depthDeep}% kompresi melebihi 6 cm. Kurangkan sedikit daya; risiko kecederaan rusuk.`);
    if (s.recoilOk != null) {
      if (s.recoilOk >= 80) good.push(`Recoil penuh pada ${s.recoilOk}% kompresi.`);
      else fix.push(`Recoil tidak penuh (${s.recoilOk}% sahaja). Angkat berat badan sepenuhnya selepas setiap tekanan, tapi jangan angkat tangan dari dada.`);
    }
    if (s.elbowOk != null) {
      if (s.elbowOk >= 80) good.push(`Siku lurus sepanjang kompresi (${s.elbowOk}%).`);
      else fix.push(`Siku bengkok pada ${(100 - s.elbowOk).toFixed(0)}% kompresi. Kunci siku dan gerak dari pinggul.`);
    }
    if (s.n >= 20 && s.fraction < 60) fix.push(`Compression fraction ${s.fraction}%. Kurangkan jeda antara kitaran (sasaran > 60%).`);
    let target;
    const weakest = [["rate", s.rateOk], ["depth", s.depthOk], ["recoil", s.recoilOk], ["elbow", s.elbowOk]]
      .filter(x => x[1] != null).sort((a, b) => a[1] - b[1])[0];
    const label = { rate: "kadar dalam julat", depth: "kedalaman dalam julat", recoil: "recoil penuh", elbow: "siku lurus" };
    if (weakest) target = `Sesi seterusnya: capai sekurang-kurangnya ${Math.min(100, Math.max(80, Math.ceil(weakest[1] / 10) * 10 + 20))}% ${label[weakest[0]]}, dalam 2 minit kompresi berterusan.`;
    return { good, fix, target };
  }

  const api = { T, jointAngle, CompressionDetector, Session, liveFeedback, coachReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CPR = api;
})(typeof self !== "undefined" ? self : this);
