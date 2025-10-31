/* script.js
   Handles:
   - Theme switching (colorful/professional/dark) persisted in localStorage
   - Collapsible chapters (keyboard accessible)
   - Reveal on scroll animations
   - Search filtering
   - Quiz autograding with model answers and progress save
   - Export/Split stubs
*/

(function () {
  // ---------- THEME -------------
  const root = document.documentElement;
  const body = document.body;
  const saved = localStorage.getItem('mm_theme') || 'colorful';
  setTheme(saved);

  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-theme');
      setTheme(t);
      localStorage.setItem('mm_theme', t);
    });
  });

  function setTheme(name) {
    body.classList.remove('theme-colorful', 'theme-professional', 'theme-dark');
    if (name === 'colorful') body.classList.add('theme-colorful');
    if (name === 'professional') body.classList.add('theme-professional');
    if (name === 'dark') body.classList.add('theme-dark');
  }

  // ---------- COLLAPSIBLES ----------
  document.querySelectorAll('.chapter').forEach(section => {
    const header = section.querySelector('.chapter-header');
    const expanded = header.getAttribute('aria-expanded') === 'true';
    if (!expanded) section.setAttribute('aria-hidden', 'true');
    header.addEventListener('click', () => toggle(section, header));
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(section, header); }
    });
  });

  function toggle(section, header) {
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', String(!isExpanded));
    if (isExpanded) section.setAttribute('aria-hidden', 'true');
    else section.removeAttribute('aria-hidden');
  }

  // ---------- REVEAL ON SCROLL ----------
  const obs = new IntersectionObserver(entries => {
    entries.forEach(ent => {
      if (ent.isIntersecting) {
        ent.target.classList.add('visible');
        obs.unobserve(ent.target);
      }
    });
  }, {threshold: 0.12});
  document.querySelectorAll('.animate').forEach(el => obs.observe(el));

  // ---------- SMOOTH SCROLL ----------
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      const id = this.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  });

  // ---------- SEARCH ----------
  const search = document.getElementById('searchInput');
  if (search) {
    search.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        document.querySelectorAll('.chapter').forEach(c => c.style.display = '');
        return;
      }
      document.querySelectorAll('.chapter').forEach(c => {
        const text = (c.getAttribute('data-keywords') || '') + ' ' + (c.textContent || '');
        const visible = text.toLowerCase().includes(q);
        c.style.display = visible ? '' : 'none';
      });
    });
  }

  // ---------- QUIZ AUTOGRADE ----------
  const modelAnswers = {
    sets: ["a set is a well-defined collection of distinct objects", "3", " (a ∪ b)' = a' ∩ b' ", "5", "{a}"],
    taxation: ["taxation is the system by which government collects money", "gst", "equity", "direct tax", "tax payable = taxable income × tax rate"],
    geometry: ["a² + b² = c²", "110", "equilateral isosceles scalene", "πr²", "5"],
    realnumbers: ["irrational", "1/3", "surd", "0.125", "rational"],
    algebra: ["x² + 6x + 9", "(x-3)(x+3)", "coefficient", "3x² + 2x + 1", "(x-y)(x² + xy + y²)"],
    mensuration: ["πr²h", "d1 × d2 / 2", "6a²", "0.02", "πrl"],
    trigonometry: ["opp/hyp", "1", "sec", "5", "surveying"],
    statistics: ["mean", "average", "bimodal", "survey", "6"],
    probability: ["1/2", "1/6", "sample space", "subset", "practice"],
    lineareq: ["4", "ax + by = c", "substitution", "slope", "substitute"]
  };

  function normalize(s) {
    if (!s) return "";
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function gradeChapter(chapter, form) {
    const model = modelAnswers[chapter] || [];
    const inputs = Array.from(form.querySelectorAll('input[name]'));
    let score = 0;
    const details = [];
    inputs.forEach((input, i) => {
      const user = normalize(input.value);
      const mod = normalize(model[i] || "");
      let ok = false;
      if (!user) ok = false;
      else if (!mod) ok = false;
      else {
        if (/^[0-9\.\-\/]+$/.test(mod) || mod.includes('π') || mod.includes('√')) {
          if (user.includes(mod) || mod.includes(user)) ok = true;
          else {
            const un = parseFloat(user), mn = parseFloat(mod);
            if (!isNaN(un) && !isNaN(mn) && Math.abs(un - mn) < 1e-6) ok = true;
          }
        } else {
          const tokens = mod.split(' ').filter(t => t.length>2);
          const matches = tokens.filter(t => user.includes(t));
          if (user === mod || matches.length >= Math.max(1, Math.floor(tokens.length/2))) ok = true;
        }
      }
      if (ok) { score++; details.push({i:i+1,ok:true}); }
      else details.push({i:i+1,ok:false,user:input.value,model:model[i]||''});
    });
    return {score, total: inputs.length, details};
  }

  document.querySelectorAll('.quiz').forEach(formContainer => {
    const form = formContainer.querySelector('form') || formContainer;
    formContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const chapter = form.getAttribute('data-chapter');
      const resultEl = document.getElementById('result-' + chapter);
      if (!resultEl) return;
      if (action === 'show') {
        const model = modelAnswers[chapter] || [];
        resultEl.innerHTML = '<strong>Model answers:</strong><ol>' + model.map(m => `<li>${escapeHtml(m)}</li>`).join('') + '</ol>';
      } else if (action === 'submit') {
        const res = gradeChapter(chapter, form);
        resultEl.innerHTML = `Score: <strong>${res.score} / ${res.total}</strong>`;
        saveProgress(chapter, res);
        const wrong = res.details.filter(d => !d.ok);
        if (wrong.length) {
          const box = document.createElement('div');
          box.className = 'quiz-review';
          box.innerHTML = '<details><summary>Review incorrect answers</summary><ul>' + wrong.map(w => `<li>Q${w.i}: Your: <em>${escapeHtml(w.user)}</em> — Model: <em>${escapeHtml(w.model)}</em></li>`).join('') + '</ul></details>';
          resultEl.appendChild(box);
        } else {
          const good = document.createElement('div');
          good.className = 'quiz-good';
          good.textContent = 'Great! All answers look good.';
          resultEl.appendChild(good);
        }
      }
    });
  });

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ---------- SAVE / LOAD progress ----------
  function saveProgress(chapter, result) {
    try {
      const key = 'mm_progress_' + chapter;
      localStorage.setItem(key, JSON.stringify({score: result.score, total: result.total, ts: Date.now()}));
    } catch(e){}
  }
  function loadProgress() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('mm_progress_')) {
        const chapter = k.replace('mm_progress_','');
        const el = document.getElementById('result-' + chapter);
        if (!el) return;
        try {
          const data = JSON.parse(localStorage.getItem(k));
          if (data) el.innerHTML = `Saved: ${data.score} / ${data.total} (on ${new Date(data.ts).toLocaleString()})`;
        } catch(e){}
      }
    });
  }
  loadProgress();

  // Clear progress
  const clearBtn = document.getElementById('clearProgress');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    Object.keys(localStorage).forEach(k => { if (k.startsWith('mm_progress_')) localStorage.removeItem(k); });
    document.querySelectorAll('.quiz-result').forEach(el => el.textContent = '');
    alert('Saved quiz progress cleared.');
  });

  // Export/Split stubs
  const exportZipBtn = document.getElementById('exportZip') || document.getElementById('exportBtn');
  if (exportZipBtn) exportZipBtn.addEventListener('click', () => {
    alert('If you want, I can prepare and provide a downloadable ZIP of the three files. Type "export zip" to request it.');
  });
  const splitBtn = document.getElementById('splitPages');
  if (splitBtn) splitBtn.addEventListener('click', () => {
    alert('I can split this into separate chapter pages. Type "split into pages" to proceed.');
  });

  // focus first expanded header
  document.addEventListener('DOMContentLoaded', () => {
    const first = document.querySelector('.chapter-header[aria-expanded="true"]');
    if (first) first.focus();
  });

})();
