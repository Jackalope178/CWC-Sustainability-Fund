(() => {
  const STORAGE_KEY = 'cwc-sustainability-fund-v1';

  const DEFAULTS = {
    goals: {
      program: 75000,
      stable: 125000,
      sustainable: 140000,
      mission: 150000,
    },
    program: [],
    foundation: [],
  };

  const fmt = (n) =>
    '$' + Math.round(n || 0).toLocaleString('en-US');

  // ---------- State ----------
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        goals: { ...DEFAULTS.goals, ...(parsed.goals || {}) },
        program: Array.isArray(parsed.program) ? parsed.program : [],
        foundation: Array.isArray(parsed.foundation) ? parsed.foundation : [],
      };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- Calculations ----------
  function totals() {
    const program = state.program.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const foundation = state.foundation.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return { program, foundation, total: program + foundation };
  }

  function meterMax() {
    // Scale the meter so the highest tier / total fits with a little headroom.
    const t = totals();
    const highestTier = Math.max(
      state.goals.program,
      state.goals.stable,
      state.goals.sustainable,
      state.goals.mission
    );
    return Math.max(highestTier, t.total) * 1.05 || 1;
  }

  // ---------- Rendering ----------
  const el = {
    fillProgram: document.getElementById('fill-program'),
    fillFoundation: document.getElementById('fill-foundation'),
    tierMarkers: document.getElementById('tier-markers'),
    scale: document.getElementById('meter-scale'),

    summaryProgram: document.getElementById('summary-program'),
    summaryFoundation: document.getElementById('summary-foundation'),
    summaryTotal: document.getElementById('summary-total'),
    summaryGap: document.getElementById('summary-gap'),
    gapLabel: document.getElementById('gap-label'),
    gapRow: document.querySelector('.summary-row.gap'),

    goalProgram: document.getElementById('goal-program'),
    goalStable: document.getElementById('goal-stable'),
    goalSustainable: document.getElementById('goal-sustainable'),
    goalMission: document.getElementById('goal-mission'),

    itemsProgram: document.getElementById('items-program'),
    itemsFoundation: document.getElementById('items-foundation'),

    subtotalProgram: document.getElementById('subtotal-program'),
    subtotalFoundation: document.getElementById('subtotal-foundation'),
  };

  function renderMeter() {
    const max = meterMax();
    const t = totals();

    const pctProgram = Math.min(100, (t.program / max) * 100);
    // Foundation height is its own share; stacking happens via flex-direction column-reverse.
    const pctFoundation = Math.min(100 - pctProgram, (t.foundation / max) * 100);

    el.fillProgram.style.height = pctProgram + '%';
    el.fillFoundation.style.height = pctFoundation + '%';

    renderTierMarkers(max);
    renderScale(max);
  }

  function renderTierMarkers(max) {
    const tiers = [
      {
        cls: 'program',
        value: state.goals.program,
        label: `${fmt(state.goals.program)} — Program revenue`,
        sub: 'Program revenue goal',
      },
      {
        cls: 'stable',
        value: state.goals.stable,
        label: `${fmt(state.goals.stable)} — Stable`,
        sub: 'Full costs covered',
      },
      {
        cls: 'sustainable',
        value: state.goals.sustainable,
        label: `${fmt(state.goals.sustainable)} — Sustainable`,
        sub: 'Buffer for growth',
      },
      {
        cls: 'mission',
        value: state.goals.mission,
        label: `${fmt(state.goals.mission)}+ — Mission`,
        sub: 'Fee reductions unlocked',
      },
    ].filter((t) => t.value && t.value <= max);

    const METER_HEIGHT = 520;
    const MIN_GAP = 58;

    // Compute true position (px from bottom) and start label at that same spot.
    tiers.forEach((t) => {
      t.truePx = (t.value / max) * METER_HEIGHT;
      t.labelPx = t.truePx;
    });

    // Sort ascending, then push overlapping labels upward.
    tiers.sort((a, b) => a.labelPx - b.labelPx);
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const cur = tiers[i];
      if (cur.labelPx - prev.labelPx < MIN_GAP) {
        cur.labelPx = prev.labelPx + MIN_GAP;
      }
    }
    // If top label pushed past the meter, cascade downward.
    for (let i = tiers.length - 1; i > 0; i--) {
      if (tiers[i].labelPx > METER_HEIGHT - 4) {
        tiers[i].labelPx = METER_HEIGHT - 4;
      }
      if (tiers[i].labelPx - tiers[i - 1].labelPx < MIN_GAP) {
        tiers[i - 1].labelPx = tiers[i].labelPx - MIN_GAP;
      }
    }

    el.tierMarkers.innerHTML = '';

    // Dashed marker lines at each tier's TRUE position.
    tiers.forEach((t) => {
      const line = document.createElement('div');
      line.className = `tier-line-mark ${t.cls}`;
      line.style.bottom = t.truePx + 'px';
      el.tierMarkers.appendChild(line);
    });

    // Text labels at the collision-adjusted positions.
    tiers.forEach((t) => {
      const node = document.createElement('div');
      node.className = `tier ${t.cls}`;
      node.style.bottom = t.labelPx + 'px';
      node.innerHTML = `
        <div class="tier-label">${t.label}</div>
        <div class="tier-sub">${t.sub}</div>
      `;
      el.tierMarkers.appendChild(node);
    });
  }

  function renderScale(max) {
    // Pick a tick step that gives 4-8 ticks.
    const roughStep = max / 6;
    const niceSteps = [1000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];
    const step = niceSteps.find((s) => s >= roughStep) || 100000;

    el.scale.innerHTML = '';
    for (let v = 0; v <= max; v += step) {
      const pct = (v / max) * 100;
      const tick = document.createElement('div');
      tick.className = 'scale-tick';
      tick.style.bottom = pct + '%';
      tick.innerHTML = `<span class="scale-label">${fmt(v)}</span>`;
      el.scale.appendChild(tick);
    }
  }

  function renderSummary() {
    const t = totals();
    el.summaryProgram.textContent = fmt(t.program);
    el.summaryFoundation.textContent = fmt(t.foundation);
    el.summaryTotal.textContent = fmt(t.total);

    // Gap to whichever is the nearest meaningful target not yet hit.
    const targets = [
      { label: 'Gap to Program goal', value: state.goals.program },
      { label: 'Gap to Stable', value: state.goals.stable },
      { label: 'Gap to Sustainable', value: state.goals.sustainable },
      { label: 'Gap to Mission', value: state.goals.mission },
    ];
    const next = targets.find((tg) => tg.value > t.total);
    if (next) {
      el.gapLabel.textContent = next.label;
      el.summaryGap.textContent = fmt(next.value - t.total) + ' needed';
      el.gapRow.classList.remove('reached');
    } else {
      el.gapLabel.textContent = 'Mission goal reached';
      el.summaryGap.textContent = fmt(t.total - state.goals.mission) + ' over';
      el.gapRow.classList.add('reached');
    }
  }

  function renderGoalsInputs() {
    el.goalProgram.value = state.goals.program;
    el.goalStable.value = state.goals.stable;
    el.goalSustainable.value = state.goals.sustainable;
    el.goalMission.value = state.goals.mission;
  }

  const tplItem = document.getElementById('tpl-item');

  function renderItems(kind) {
    const container = kind === 'program' ? el.itemsProgram : el.itemsFoundation;
    container.innerHTML = '';
    state[kind].forEach((item, idx) => {
      const node = tplItem.content.firstElementChild.cloneNode(true);
      const nameInput = node.querySelector('.item-name');
      const amountInput = node.querySelector('.item-amount');
      const removeBtn = node.querySelector('.btn-remove');

      nameInput.value = item.name || '';
      amountInput.value = item.amount === 0 || item.amount ? item.amount : '';

      nameInput.addEventListener('input', (e) => {
        state[kind][idx].name = e.target.value;
        save();
      });
      amountInput.addEventListener('input', (e) => {
        const v = e.target.value === '' ? 0 : Number(e.target.value);
        state[kind][idx].amount = Number.isFinite(v) && v >= 0 ? v : 0;
        save();
        renderMeter();
        renderSummary();
        renderSubtotals();
      });
      removeBtn.addEventListener('click', () => {
        state[kind].splice(idx, 1);
        save();
        renderItems(kind);
        renderMeter();
        renderSummary();
        renderSubtotals();
      });

      container.appendChild(node);
    });
  }

  function renderSubtotals() {
    const t = totals();
    el.subtotalProgram.textContent = fmt(t.program);
    el.subtotalFoundation.textContent = fmt(t.foundation);
  }

  function renderAll() {
    renderGoalsInputs();
    renderItems('program');
    renderItems('foundation');
    renderMeter();
    renderSummary();
    renderSubtotals();
  }

  // ---------- Events ----------
  function bindGoals() {
    const map = [
      ['goalProgram', 'program'],
      ['goalStable', 'stable'],
      ['goalSustainable', 'sustainable'],
      ['goalMission', 'mission'],
    ];
    map.forEach(([elKey, stateKey]) => {
      el[elKey].addEventListener('input', (e) => {
        const v = e.target.value === '' ? 0 : Number(e.target.value);
        state.goals[stateKey] = Number.isFinite(v) && v >= 0 ? v : 0;
        save();
        renderMeter();
        renderSummary();
      });
    });
  }

  function bindAddButtons() {
    document.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-add');
        state[kind].push({ name: '', amount: 0 });
        save();
        renderItems(kind);
        const container = kind === 'program' ? el.itemsProgram : el.itemsFoundation;
        const last = container.querySelector('.item-row:last-child .item-name');
        if (last) last.focus();
      });
    });
  }

  function bindDataButtons() {
    document.getElementById('btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `cwc-sustainability-fund-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    document.getElementById('file-import').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          state = {
            goals: { ...DEFAULTS.goals, ...(parsed.goals || {}) },
            program: Array.isArray(parsed.program) ? parsed.program : [],
            foundation: Array.isArray(parsed.foundation) ? parsed.foundation : [],
          };
          save();
          renderAll();
        } catch {
          alert('That file could not be read as a valid tracker export.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('Reset all goals and entries back to defaults? This cannot be undone.')) return;
      state = structuredClone(DEFAULTS);
      save();
      renderAll();
    });
  }

  // ---------- Init ----------
  bindGoals();
  bindAddButtons();
  bindDataButtons();
  renderAll();
})();
