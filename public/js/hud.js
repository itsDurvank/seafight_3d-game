// Small helper that owns every piece of on-screen UI.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hpFill: $('hp-fill'), hpText: $('hp-text'),
    speed: $('speed-text'), speedPanel: $('speed'), speedIcon: $('speed-icon'), speedGear: $('speed-gear'),
    boostBar: $('boost-fill'), kills: $('kills'),
    gun: $('gun-slot'), missile: $('missile-slot'), cd: $('missile-cd'), cdText: $('missile-time'),
    boost: $('boost-slot'), boostCd: $('boost-cd'), boostText: $('boost-time'),
    flash: $('flash'), toast: $('toast'), hitmarker: $('hitmarker'),
  };
  let flashV = 0;
  let hitV = 0;
  let toastTimer = null;

  return {
    flash(v = 0.7) { flashV = Math.max(flashV, v); },

    hit() { hitV = 1; },

    toast(msg, ms = 0) {
      el.toast.innerHTML = msg;
      el.toast.classList.remove('hide');
      clearTimeout(toastTimer);
      if (ms) toastTimer = setTimeout(() => el.toast.classList.add('hide'), ms);
    },

    update(dt, s) {
      const f = Math.max(0, Math.min(1, s.hp / s.maxHp));
      el.hpFill.style.width = `${f * 100}%`;
      el.hpFill.classList.toggle('mid', f <= 0.5 && f > 0.25);
      el.hpFill.classList.toggle('low', f <= 0.25);
      el.hpText.textContent = Math.ceil(s.hp);

      const rawSpeed = s.speed || 0;
      const isRev = rawSpeed < -0.5;
      const isBoosting = !!s.boosting;
      const absSpeed = Math.abs(rawSpeed);

      el.speed.textContent = absSpeed.toFixed(0);

      if (isBoosting) {
        if (el.speedGear) { el.speedGear.textContent = 'BOOST'; el.speedGear.className = 'gear-tag boost'; }
        if (el.speedIcon) el.speedIcon.textContent = '🔥';
        if (el.speedPanel) { el.speedPanel.classList.add('boosting'); el.speedPanel.classList.remove('reversing'); }
      } else if (isRev) {
        if (el.speedGear) { el.speedGear.textContent = 'REV'; el.speedGear.className = 'gear-tag rev'; }
        if (el.speedIcon) el.speedIcon.textContent = '⚓';
        if (el.speedPanel) { el.speedPanel.classList.add('reversing'); el.speedPanel.classList.remove('boosting'); }
      } else {
        if (el.speedGear) el.speedGear.className = 'gear-tag hidden';
        if (el.speedIcon) el.speedIcon.textContent = '⚓';
        if (el.speedPanel) el.speedPanel.classList.remove('reversing', 'boosting');
      }

      // Responsive fill bar:
      // In reverse: fills proportional to reverse limit (30 km/h)
      // Forward: fills proportional to boost max (150 km/h, where 90 km/h cruise is 60%)
      let fillPct = 0;
      if (isRev) {
        fillPct = Math.min(100, (absSpeed / 30) * 100);
      } else {
        const maxSpd = s.boostMaxSpeed || 150;
        fillPct = Math.min(100, (absSpeed / maxSpd) * 100);
      }
      el.boostBar.style.width = `${fillPct.toFixed(1)}%`;
      el.kills.textContent = s.kills;

      el.gun.classList.toggle('active', s.gunFiring);
      el.gun.classList.toggle('selected', s.weapon === 'gun');
      el.missile.classList.toggle('selected', s.weapon === 'missile');
      const ready = s.missileCd <= 0;
      el.missile.classList.toggle('ready', ready);
      el.cd.style.height = `${(s.missileCd / s.missileMax) * 100}%`;
      el.cdText.textContent = ready ? 'READY' : `${s.missileCd.toFixed(1)}s`;

      // boost meter: shows the seconds of boost left; the dark overlay shows what is used up
      const full = s.boostEnergy >= s.boostMax - 0.05;
      el.boostCd.style.height = `${(1 - s.boostEnergy / s.boostMax) * 100}%`;
      el.boost.classList.toggle('active', s.boosting);
      el.boost.classList.toggle('ready', !s.boosting && s.boostEnergy >= s.boostMin);
      el.boostText.textContent = s.boosting || !full ? `${s.boostEnergy.toFixed(1)}s` : 'READY';

      flashV = Math.max(0, flashV - dt * 1.6);
      el.flash.style.opacity = flashV;
      hitV = Math.max(0, hitV - dt * 6);
      el.hitmarker.style.opacity = hitV;
      el.hitmarker.style.transform = `translate(-50%,-50%) rotate(45deg) scale(${0.8 + hitV * 0.5})`;
    },
  };
}
