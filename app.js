/* =========================================================
   PULSO — app.js
   Toda a lógica: estado local, navegação, CRUD e câmara IA.
   ========================================================= */
(() => {
  "use strict";

  const STORAGE_KEY = "pulso_data_v1";
  const todayStr = (d = new Date()) => d.toISOString().slice(0, 10);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const DEFAULT_DATA = {
    onboarded: false,
    profile: { name: "", height: 175, weight: 70, age: 30, sex: "m", goal: "manter", activity: "moderado", apiKey: "" },
    weights: [],
    exercises: [],
    sleep: [],
    recipes: [],
    foodLog: [],
    stress: [],
    screenTime: {},
  };

  let data = loadData();

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      return Object.assign(structuredClone(DEFAULT_DATA), parsed);
    } catch (e) {
      console.error("Erro ao carregar dados", e);
      return structuredClone(DEFAULT_DATA);
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- Icons por categoria ----------
  const ICONS = {
    exercise: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 8 4-16 2 8h6"/></svg>`,
    food: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v7a2 2 0 002 2h1a2 2 0 002-2V3M6 3v18M14 3v6a2 2 0 002 2v10M14 3s0 6 4 6"/></svg>`,
    sleep: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
    stress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2a5.5 5.5 0 00-5 8 5.5 5.5 0 005 8h5a5.5 5.5 0 005-8 5.5 5.5 0 00-5-8z"/></svg>`,
  };

  // =========================================================
  // ONBOARDING
  // =========================================================
  const onboardEl = document.getElementById("onboard");
  const appEl = document.getElementById("app");
  let obStep = 0;
  const obSteps = document.querySelectorAll(".onboard-step");
  const obDotsWrap = document.getElementById("onboardDots");
  let obGoal = "manter", obActivity = "moderado";

  function renderDots() {
    obDotsWrap.innerHTML = "";
    obSteps.forEach((_, i) => {
      const s = document.createElement("span");
      if (i <= obStep) s.classList.add("done");
      obDotsWrap.appendChild(s);
    });
  }

  function goStep(n) {
    obStep = Math.max(0, Math.min(obSteps.length - 1, n));
    obSteps.forEach((s) => s.classList.toggle("active", +s.dataset.step === obStep));
    renderDots();
  }

  document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => goStep(obStep + 1)));
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => goStep(obStep - 1)));

  document.getElementById("ob_goal").addEventListener("click", (e) => {
    const card = e.target.closest(".choice-card");
    if (!card) return;
    document.querySelectorAll("#ob_goal .choice-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    obGoal = card.dataset.val;
  });
  document.getElementById("ob_activity").addEventListener("click", (e) => {
    const card = e.target.closest(".choice-card");
    if (!card) return;
    document.querySelectorAll("#ob_activity .choice-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    obActivity = card.dataset.val;
  });

  document.getElementById("ob_finish").addEventListener("click", () => {
    data.profile.name = document.getElementById("ob_name").value.trim() || "Atleta";
    data.profile.height = +document.getElementById("ob_height").value || 175;
    data.profile.weight = +document.getElementById("ob_weight").value || 70;
    data.profile.age = +document.getElementById("ob_age").value || 30;
    data.profile.sex = document.getElementById("ob_sex").value;
    data.profile.goal = obGoal;
    data.profile.activity = obActivity;
    data.weights.push({ date: todayStr(), kg: data.profile.weight });
    data.onboarded = true;
    saveData();
    launchApp();
  });

  renderDots();

  // =========================================================
  // NAVEGAÇÃO
  // =========================================================
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
    renderScreen(name);
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => showScreen(el.dataset.nav)));

  function renderScreen(name) {
    if (name === "dashboard") renderDashboard();
    if (name === "exercise") renderExercise();
    if (name === "food") renderFood();
    if (name === "sleep") renderSleep();
    if (name === "stress") renderStress();
  }

  // =========================================================
  // METAS (calculadas a partir do perfil)
  // =========================================================
  const ACTIVITY_FACTOR = { sedentario: 1.2, leve: 1.375, moderado: 1.55, intenso: 1.725 };
  const EXERCISE_GOAL_MIN = { sedentario: 10, leve: 20, moderado: 35, intenso: 50 };

  function computeCalorieGoal() {
    const p = data.profile;
    const bmr = p.sex === "f"
      ? 10 * p.weight + 6.25 * p.height - 5 * p.age - 161
      : 10 * p.weight + 6.25 * p.height - 5 * p.age + 5;
    let tdee = bmr * (ACTIVITY_FACTOR[p.activity] || 1.375);
    if (p.goal === "perder") tdee -= 400;
    if (p.goal === "ganhar") tdee += 300;
    return Math.max(1200, Math.round(tdee));
  }

  function exerciseGoalMin() {
    return EXERCISE_GOAL_MIN[data.profile.activity] || 25;
  }

  // =========================================================
  // RINGS (elemento de assinatura do dashboard)
  // =========================================================
  function ringArc(cx, cy, r, pct, color) {
    pct = Math.max(0, Math.min(1, pct));
    const circumference = 2 * Math.PI * r;
    const dash = circumference * pct;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.18" stroke-width="9"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="9"
        stroke-dasharray="${dash} ${circumference}" stroke-linecap="round"
        transform="rotate(-90 ${cx} ${cy})"/>`;
  }

  function renderDashboard() {
    const t = todayStr();
    const exMinToday = data.exercises.filter((e) => e.date === t).reduce((a, e) => a + (+e.duration || 0), 0);
    const calToday = data.foodLog.filter((f) => f.date === t).reduce((a, f) => a + (+f.cal || 0), 0);
    const lastSleep = [...data.sleep].sort((a, b) => b.date.localeCompare(a.date))[0];
    const sleepH = lastSleep ? lastSleep.hours : 0;
    const stress = computeStressScore();

    const calGoal = computeCalorieGoal();
    const exGoal = exerciseGoalMin();
    const sleepGoal = 8;

    const pctEx = exMinToday / exGoal;
    const pctFood = calToday / calGoal;
    const pctSleep = sleepH / sleepGoal;
    const pctStress = (10 - stress) / 10; // maior = melhor (menos stress)

    const svg = document.getElementById("ringsSvg");
    svg.innerHTML = `
      ${ringArc(60, 60, 50, pctEx, getCss("--c-exercise"))}
      ${ringArc(60, 60, 38, pctFood, getCss("--c-food"))}
      ${ringArc(60, 60, 26, pctSleep, getCss("--c-sleep"))}
    `;

    document.getElementById("ringsLegend").innerHTML = `
      <div class="row"><span class="label"><span class="dot" style="background:var(--c-exercise)"></span>Treino</span><span class="val">${exMinToday}/${exGoal} min</span></div>
      <div class="row"><span class="label"><span class="dot" style="background:var(--c-food)"></span>Alimentação</span><span class="val">${calToday}/${calGoal} kcal</span></div>
      <div class="row"><span class="label"><span class="dot" style="background:var(--c-sleep)"></span>Sono</span><span class="val">${sleepH.toFixed(1)}/${sleepGoal} h</span></div>
      <div class="row"><span class="label"><span class="dot" style="background:var(--c-stress)"></span>Stress</span><span class="val">${stress}/10</span></div>
    `;

    document.getElementById("dashStats").innerHTML = `
      <div class="stat-card"><div class="bar" style="background:var(--c-exercise)"></div>
        <div class="value">${exMinToday}<span class="unit">min</span></div><div class="label">Exercício hoje</div></div>
      <div class="stat-card"><div class="bar" style="background:var(--c-food)"></div>
        <div class="value">${calToday}<span class="unit">kcal</span></div><div class="label">Ingeridas hoje</div></div>
      <div class="stat-card"><div class="bar" style="background:var(--c-sleep)"></div>
        <div class="value">${sleepH.toFixed(1)}<span class="unit">h</span></div><div class="label">Sono última noite</div></div>
      <div class="stat-card"><div class="bar" style="background:var(--c-stress)"></div>
        <div class="value">${stress}<span class="unit">/10</span></div><div class="label">Índice de stress</div></div>
    `;

    const recent = [...data.exercises].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    document.getElementById("dashRecent").innerHTML = recent.length ? recent.map(exerciseCardHtml).join("") : emptyState("exercise", "Sem treinos ainda", "Toca em + para registares o primeiro.");
  }

  function getCss(varName) { return getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); }

  function emptyState(cat, title, sub) {
    return `<div class="empty-state"><div class="icon" style="color:var(--c-${cat})">${ICONS[cat]}</div><div class="title">${title}</div><div class="sub">${sub}</div></div>`;
  }

  // =========================================================
  // EXERCÍCIO
  // =========================================================
  function exerciseCardHtml(e) {
    return `<div class="entry-card card exercise" data-id="${e.id}" data-kind="exercise">
      <div class="pill-icon" style="background:var(--c-exercise-bg); color:var(--c-exercise);">${ICONS.exercise}</div>
      <div class="meta"><div class="title">${e.type}</div><div class="sub">${formatDate(e.date)} · ${e.intensity}${e.distance ? " · " + e.distance + " km" : ""}</div></div>
      <div class="right"><b>${e.duration}</b>min</div>
    </div>`;
  }

  function formatDate(d) {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  }

  function renderExercise() {
    const week = last7Dates();
    const totals = week.map((d) => data.exercises.filter((e) => e.date === d).reduce((a, e) => a + (+e.duration || 0), 0));
    const max = Math.max(1, ...totals);
    document.getElementById("weekExerciseTotal").textContent = totals.reduce((a, b) => a + b, 0) + " min";
    document.getElementById("exerciseBars").innerHTML = week.map((d, i) => `
      <div class="col"><div class="bar" style="height:${(totals[i] / max) * 100}%; background:var(--c-exercise);"></div><div class="d">${dayLetter(d)}</div></div>
    `).join("");

    const list = [...data.exercises].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById("exerciseList").innerHTML = list.length ? list.map(exerciseCardHtml).join("") : emptyState("exercise", "Ainda sem treinos", "Regista corridas, treinos de força e mais.");
  }

  function last7Dates() {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(todayStr(d));
    }
    return arr;
  }
  function dayLetter(dstr) {
    const d = new Date(dstr + "T00:00:00");
    return "DSTQQSS"[d.getDay()] || "";
  }

  document.getElementById("btnSaveExercise").addEventListener("click", () => {
    const duration = +document.getElementById("ex_duration").value;
    if (!duration) { toast("Indica a duração do treino."); return; }
    data.exercises.push({
      id: uid(), date: todayStr(),
      type: document.getElementById("ex_type").value,
      duration, distance: +document.getElementById("ex_distance").value || 0,
      intensity: document.querySelector("#ex_intensity .active").dataset.val,
    });
    saveData();
    closeAllSheets();
    showScreen("exercise");
    toast("Treino registado 💪");
  });

  // =========================================================
  // SONO
  // =========================================================
  function sleepHoursBetween(bed, wake) {
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    let bedMin = bh * 60 + bm, wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    return +(((wakeMin - bedMin) / 60).toFixed(1));
  }

  function sleepCardHtml(s) {
    return `<div class="entry-card card sleep" data-id="${s.id}" data-kind="sleep">
      <div class="pill-icon" style="background:var(--c-sleep-bg); color:var(--c-sleep);">${ICONS.sleep}</div>
      <div class="meta"><div class="title">${s.hours}h · ${s.quality}</div><div class="sub">${formatDate(s.date)} · ${s.bed} → ${s.wake}</div></div>
      <div class="right"><b>${s.hours}</b>h</div>
    </div>`;
  }

  function renderSleep() {
    const week = last7Dates();
    const byDate = {};
    data.sleep.forEach((s) => (byDate[s.date] = s.hours));
    const totals = week.map((d) => byDate[d] || 0);
    const withData = totals.filter((v) => v > 0);
    const avg = withData.length ? (withData.reduce((a, b) => a + b, 0) / withData.length).toFixed(1) : "—";
    document.getElementById("sleepAvg").textContent = avg + " h";
    const max = Math.max(8, ...totals);
    document.getElementById("sleepBars").innerHTML = week.map((d, i) => `
      <div class="col"><div class="bar" style="height:${(totals[i] / max) * 100}%; background:var(--c-sleep);"></div><div class="d">${dayLetter(d)}</div></div>
    `).join("");

    const list = [...data.sleep].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById("sleepList").innerHTML = list.length ? list.map(sleepCardHtml).join("") : emptyState("sleep", "Ainda sem registos de sono", "Regista as tuas horas para veres tendências.");
  }

  document.getElementById("btnSaveSleep").addEventListener("click", () => {
    const bed = document.getElementById("sl_bed").value;
    const wake = document.getElementById("sl_wake").value;
    const hours = sleepHoursBetween(bed, wake);
    data.sleep.push({ id: uid(), date: todayStr(), bed, wake, hours, quality: document.querySelector("#sl_quality .active").dataset.val });
    saveData();
    closeAllSheets();
    showScreen("sleep");
    toast("Sono registado 🌙");
  });

  // =========================================================
  // ALIMENTAÇÃO — receitas + registo diário
  // =========================================================
  function recipeCardHtml(r) {
    return `<div class="recipe-card" data-id="${r.id}" data-action="pick-recipe">
      <div class="rname">${r.name}</div>
      <div class="rmacro">${r.cal} kcal · P${r.prot}g H${r.carb}g G${r.fat}g</div>
    </div>`;
  }

  function foodLogCardHtml(f) {
    return `<div class="entry-card card food" data-id="${f.id}" data-kind="food">
      <div class="pill-icon" style="background:var(--c-food-bg); color:var(--c-food);">${ICONS.food}</div>
      <div class="meta"><div class="title">${f.name}</div><div class="sub">${f.meal}${f.source === "ia" ? " · reconhecido por IA" : ""}</div></div>
      <div class="right"><b>${f.cal}</b>kcal</div>
    </div>`;
  }

  function renderFood() {
    document.getElementById("recipeGrid").innerHTML = data.recipes.length
      ? data.recipes.map(recipeCardHtml).join("")
      : `<div style="grid-column:1/-1;">${emptyState("food", "Ainda sem receitas", "Cria a primeira receita para a reutilizares sempre.")}</div>`;

    const t = todayStr();
    const todays = data.foodLog.filter((f) => f.date === t);
    const totalCal = todays.reduce((a, f) => a + (+f.cal || 0), 0);
    document.getElementById("todayCalValue").innerHTML = `${totalCal} <span style="font-size:16px;color:var(--text-dim);font-family:var(--font-body);">kcal</span>`;
    document.getElementById("todayCalTarget").textContent = "meta " + computeCalorieGoal() + " kcal";
    document.getElementById("foodLogList").innerHTML = todays.length ? todays.map(foodLogCardHtml).join("") : emptyState("food", "Ainda sem refeições hoje", "Adiciona uma receita ou usa a câmara IA.");
  }

  document.getElementById("foodTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#foodTabs button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("foodTab-log").classList.toggle("hidden", btn.dataset.tab !== "log");
    document.getElementById("foodTab-recipes").classList.toggle("hidden", btn.dataset.tab !== "recipes");
  });

  document.getElementById("btnAddRecipe").addEventListener("click", () => openRecipeSheet());

  function openRecipeSheet(recipe) {
    document.getElementById("recipeSheetTitle").textContent = recipe ? "Editar receita" : "Nova receita";
    document.getElementById("rc_id").value = recipe ? recipe.id : "";
    document.getElementById("rc_name").value = recipe ? recipe.name : "";
    document.getElementById("rc_cal").value = recipe ? recipe.cal : "";
    document.getElementById("rc_prot").value = recipe ? recipe.prot : "";
    document.getElementById("rc_carb").value = recipe ? recipe.carb : "";
    document.getElementById("rc_fat").value = recipe ? recipe.fat : "";
    document.getElementById("rc_notes").value = recipe ? recipe.notes || "" : "";
    openSheet("sheet-recipe");
  }

  document.getElementById("btnSaveRecipe").addEventListener("click", () => {
    const name = document.getElementById("rc_name").value.trim();
    if (!name) { toast("Dá um nome à receita."); return; }
    const id = document.getElementById("rc_id").value;
    const rec = {
      id: id || uid(),
      name,
      cal: +document.getElementById("rc_cal").value || 0,
      prot: +document.getElementById("rc_prot").value || 0,
      carb: +document.getElementById("rc_carb").value || 0,
      fat: +document.getElementById("rc_fat").value || 0,
      notes: document.getElementById("rc_notes").value.trim(),
    };
    if (id) {
      const idx = data.recipes.findIndex((r) => r.id === id);
      if (idx >= 0) data.recipes[idx] = rec;
    } else {
      data.recipes.push(rec);
    }
    saveData();
    closeAllSheets();
    renderFood();
    toast("Receita guardada 🍳");
  });

  document.getElementById("recipeGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".recipe-card");
    if (!card) return;
    openLogFoodSheet(card.dataset.id);
  });

  function openLogFoodSheet(recipeId) {
    const sel = document.getElementById("lf_recipe");
    sel.innerHTML = data.recipes.map((r) => `<option value="${r.id}">${r.name} (${r.cal} kcal)</option>`).join("");
    if (recipeId) sel.value = recipeId;
    openSheet("sheet-logfood");
  }

  document.getElementById("btnConfirmLogFood").addEventListener("click", () => {
    const recipeId = document.getElementById("lf_recipe").value;
    const recipe = data.recipes.find((r) => r.id === recipeId);
    if (!recipe) { toast("Escolhe uma receita."); return; }
    data.foodLog.push({
      id: uid(), date: todayStr(), meal: document.querySelector("#lf_meal .active").dataset.val,
      recipeId: recipe.id, name: recipe.name, cal: recipe.cal, prot: recipe.prot, carb: recipe.carb, fat: recipe.fat, source: "receita",
    });
    saveData();
    closeAllSheets();
    showScreen("food");
    toast("Refeição adicionada 🍽️");
  });

  // segmented genérico (intensidade, qualidade sono, refeição)
  document.querySelectorAll(".segmented").forEach((seg) => {
    if (seg.id === "foodTabs") return;
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // =========================================================
  // STRESS / TEMPO DE ECRÃ
  // =========================================================
  let visibleSince = document.visibilityState === "visible" ? Date.now() : null;

  function addScreenSeconds(sec) {
    const t = todayStr();
    data.screenTime[t] = (data.screenTime[t] || 0) + sec;
    saveData();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && visibleSince) {
      addScreenSeconds(Math.round((Date.now() - visibleSince) / 1000));
      visibleSince = null;
    } else if (document.visibilityState === "visible") {
      visibleSince = Date.now();
    }
  });
  window.addEventListener("beforeunload", () => {
    if (visibleSince) addScreenSeconds(Math.round((Date.now() - visibleSince) / 1000));
  });
  setInterval(() => {
    if (visibleSince) {
      const now = Date.now();
      addScreenSeconds(Math.round((now - visibleSince) / 1000));
      visibleSince = now;
    }
  }, 20000);

  function screenMinutesToday() {
    return Math.round((data.screenTime[todayStr()] || 0) / 60);
  }

  function computeStressScore() {
    const t = todayStr();
    const selfEntries = data.stress.filter((s) => s.date === t);
    const selfRating = selfEntries.length ? selfEntries[selfEntries.length - 1].rating : 5;
    const screenMin = screenMinutesToday();
    const screenFactor = Math.min(screenMin / 180, 1) * 10;
    const lastSleep = [...data.sleep].sort((a, b) => b.date.localeCompare(a.date))[0];
    const sleepH = lastSleep ? lastSleep.hours : 7;
    const sleepFactor = Math.max(0, Math.min(10, ((8 - sleepH) / 8) * 10));
    const score = Math.round(0.5 * selfRating + 0.3 * screenFactor + 0.2 * sleepFactor);
    return Math.max(1, Math.min(10, score));
  }

  function renderStress() {
    document.getElementById("screenTimeToday").innerHTML = `${screenMinutesToday()}<span class="unit">min</span>`;
    document.getElementById("stressScoreVal").textContent = computeStressScore() + "/10";
  }

  const stressSlider = document.getElementById("stressSlider");
  stressSlider.addEventListener("input", () => (document.getElementById("stressSliderVal").textContent = stressSlider.value));
  document.getElementById("btnSaveStress").addEventListener("click", () => {
    data.stress.push({ id: uid(), date: todayStr(), ts: Date.now(), rating: +stressSlider.value });
    saveData();
    renderStress();
    toast("Estado registado 🧘");
  });

  // =========================================================
  // PERFIL
  // =========================================================
  function fillProfileForm() {
    const p = data.profile;
    document.getElementById("pf_name").value = p.name;
    document.getElementById("pf_height").value = p.height;
    document.getElementById("pf_weight").value = p.weight;
    document.getElementById("pf_age").value = p.age;
    document.getElementById("pf_sex").value = p.sex;
    document.getElementById("pf_goal").value = p.goal;
    document.getElementById("pf_apikey").value = p.apiKey || "";
    renderWeightBars();
    document.getElementById("greetingText").textContent = "Olá, " + (p.name || "atleta") + " 👋";
  }

  function renderWeightBars() {
    const list = [...data.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    const max = Math.max(1, ...list.map((w) => w.kg));
    document.getElementById("weightBars").innerHTML = list.length ? list.map((w) => `
      <div class="col"><div class="bar" style="height:${(w.kg / max) * 100}%; background:var(--c-exercise);"></div><div class="d">${w.kg}kg</div></div>
    `).join("") : `<span class="muted" style="font-size:13px;">Sem registos ainda.</span>`;
  }

  document.getElementById("btnSaveProfile").addEventListener("click", () => {
    const p = data.profile;
    p.name = document.getElementById("pf_name").value.trim() || "Atleta";
    p.height = +document.getElementById("pf_height").value || p.height;
    p.weight = +document.getElementById("pf_weight").value || p.weight;
    p.age = +document.getElementById("pf_age").value || p.age;
    p.sex = document.getElementById("pf_sex").value;
    p.goal = document.getElementById("pf_goal").value;
    saveData();
    document.getElementById("greetingText").textContent = "Olá, " + p.name + " 👋";
    toast("Perfil atualizado ✅");
  });

  document.getElementById("btnAddWeight").addEventListener("click", () => {
    const kg = +document.getElementById("pf_weight_new").value;
    if (!kg) { toast("Indica um peso válido."); return; }
    data.weights.push({ date: todayStr(), kg });
    data.profile.weight = kg;
    document.getElementById("pf_weight").value = kg;
    document.getElementById("pf_weight_new").value = "";
    saveData();
    renderWeightBars();
    toast("Peso registado ⚖️");
  });

  document.getElementById("btnSaveKey").addEventListener("click", () => {
    data.profile.apiKey = document.getElementById("pf_apikey").value.trim();
    saveData();
    toast("Chave guardada neste dispositivo 🔒");
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulso-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm("Isto apaga todos os dados guardados neste telemóvel. Continuar?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  document.getElementById("btnSettings").addEventListener("click", () => showScreen("profile"));

  // =========================================================
  // SHEETS (genérico)
  // =========================================================
  function openSheet(id) { document.getElementById(id).classList.add("open"); }
  function closeAllSheets() { document.querySelectorAll(".sheet-backdrop").forEach((s) => s.classList.remove("open")); }
  document.querySelectorAll(".sheet-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeAllSheets(); });
  });
  document.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", closeAllSheets));

  // FAB
  document.getElementById("fabAdd").addEventListener("click", () => openSheet("sheet-fab"));
  document.getElementById("fab-exercise").addEventListener("click", () => { closeAllSheets(); openSheet("sheet-exercise"); });
  document.getElementById("fab-sleep").addEventListener("click", () => { closeAllSheets(); openSheet("sheet-sleep"); });
  document.getElementById("fab-food").addEventListener("click", () => { closeAllSheets(); openLogFoodSheet(); });
  document.getElementById("fab-camera").addEventListener("click", () => { closeAllSheets(); openCamera(); });

  // =========================================================
  // CÂMARA + RECONHECIMENTO POR IA (Claude Vision)
  // =========================================================
  const cameraWrap = document.getElementById("cameraWrap");
  const cameraVideo = document.getElementById("cameraVideo");
  const cameraCanvas = document.getElementById("cameraCanvas");
  const cameraResult = document.getElementById("cameraResult");
  let mediaStream = null;

  async function openCamera() {
    cameraWrap.classList.add("open");
    cameraResult.classList.remove("open");
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      cameraVideo.srcObject = mediaStream;
    } catch (err) {
      toast("Não foi possível aceder à câmara.");
      closeCamera();
    }
  }
  function closeCamera() {
    cameraWrap.classList.remove("open");
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
  }
  document.getElementById("btnCloseCamera").addEventListener("click", closeCamera);
  document.getElementById("btnCloseResult").addEventListener("click", () => { cameraResult.classList.remove("open"); closeCamera(); showScreen("food"); });

  document.getElementById("btnShutter").addEventListener("click", async () => {
    const w = cameraVideo.videoWidth, h = cameraVideo.videoHeight;
    if (!w) return;
    cameraCanvas.width = w; cameraCanvas.height = h;
    cameraCanvas.getContext("2d").drawImage(cameraVideo, 0, 0, w, h);
    const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.82);
    document.getElementById("resultImg").src = dataUrl;
    cameraResult.classList.add("open");
    if (mediaStream) { mediaStream.getTracks().forEach((t) => t.stop()); mediaStream = null; }
    analyzeFood(dataUrl);
  });

  async function analyzeFood(dataUrl) {
    const body = document.getElementById("resultBody");
    const apiKey = data.profile.apiKey;
    if (!apiKey) {
      body.innerHTML = `<div class="card"><b>Precisas de uma chave de API</b><p class="muted" style="font-size:13px;margin-top:8px;">Vai a Perfil → Inteligência Artificial e cola a tua chave da Anthropic para ativar o reconhecimento automático de alimentos.</p>
        <button class="btn btn-primary mt-16" id="goToProfileBtn">Ir a Perfil</button></div>`;
      document.getElementById("goToProfileBtn").addEventListener("click", () => { cameraResult.classList.remove("open"); showScreen("profile"); });
      return;
    }

    body.innerHTML = `<div class="analysis-loading"><div class="spinner"></div><div>A identificar a refeição com IA…</div></div>`;

    const base64 = dataUrl.split(",")[1];
    const prompt = `Identifica o alimento ou refeição nesta foto. Responde APENAS com um objeto JSON válido, sem markdown nem texto adicional, no formato exato:
{"nome":"nome curto do prato","descricao":"breve descrição do que vês, 1 frase","kcal_estimado":numero,"proteina_g":numero,"hidratos_g":numero,"gordura_g":numero,"confianca":"alta|media|baixa"}
Estima valores nutricionais aproximados para a porção visível na imagem.`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error("HTTP " + resp.status + " " + errText.slice(0, 200));
      }
      const json = await resp.json();
      const textBlock = (json.content || []).find((c) => c.type === "text");
      if (!textBlock) throw new Error("Resposta sem texto");
      let clean = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      const result = JSON.parse(clean);
      renderFoodAnalysis(result);
    } catch (err) {
      console.error(err);
      body.innerHTML = `<div class="card"><b>Não foi possível analisar a foto</b>
        <p class="muted" style="font-size:13px;margin-top:8px;">Verifica a tua ligação e se a chave de API está correta. Detalhe técnico: ${escapeHtml(String(err.message || err)).slice(0,180)}</p>
        <button class="btn btn-secondary mt-16" id="retryBtn">Tentar de novo</button></div>`;
      document.getElementById("retryBtn").addEventListener("click", () => analyzeFood(dataUrl));
    }
  }

  function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function renderFoodAnalysis(r) {
    const body = document.getElementById("resultBody");
    body.innerHTML = `
      <div class="card">
        <div class="row-between"><h3 style="font-size:18px;">${escapeHtml(r.nome || "Refeição")}</h3><span class="tag" style="background:var(--c-food-bg); color:var(--c-food);">${r.confianca || "—"} confiança</span></div>
        <p class="muted" style="font-size:13px; margin-top:8px;">${escapeHtml(r.descricao || "")}</p>
        <div class="stat-grid mt-16">
          <div class="stat-card"><div class="bar" style="background:var(--c-food)"></div><div class="value">${r.kcal_estimado || 0}</div><div class="label">kcal estimadas</div></div>
          <div class="stat-card"><div class="bar" style="background:var(--c-exercise)"></div><div class="value">${r.proteina_g || 0}<span class="unit">g</span></div><div class="label">Proteína</div></div>
          <div class="stat-card"><div class="bar" style="background:var(--c-sleep)"></div><div class="value">${r.hidratos_g || 0}<span class="unit">g</span></div><div class="label">Hidratos</div></div>
          <div class="stat-card"><div class="bar" style="background:var(--c-stress)"></div><div class="value">${r.gordura_g || 0}<span class="unit">g</span></div><div class="label">Gordura</div></div>
        </div>
      </div>
      <div class="segmented mt-16" id="ai_meal">
        <button class="active" data-val="Pequeno-almoço">Manhã</button><button data-val="Almoço">Almoço</button><button data-val="Lanche">Lanche</button><button data-val="Jantar">Jantar</button>
      </div>
      <button class="btn btn-primary mt-16" id="btnAddAiFood">Adicionar às refeições de hoje</button>
      <button class="btn btn-secondary mt-8" id="btnSaveAiRecipe">Guardar como receita</button>
    `;
    document.querySelector("#ai_meal").addEventListener("click", (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      document.querySelectorAll("#ai_meal button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
    document.getElementById("btnAddAiFood").addEventListener("click", () => {
      data.foodLog.push({
        id: uid(), date: todayStr(), meal: document.querySelector("#ai_meal .active").dataset.val,
        recipeId: null, name: r.nome || "Refeição (IA)", cal: r.kcal_estimado || 0,
        prot: r.proteina_g || 0, carb: r.hidratos_g || 0, fat: r.gordura_g || 0, source: "ia",
      });
      saveData();
      cameraResult.classList.remove("open");
      showScreen("food");
      toast("Refeição adicionada com IA 📷");
    });
    document.getElementById("btnSaveAiRecipe").addEventListener("click", () => {
      data.recipes.push({ id: uid(), name: r.nome || "Receita (IA)", cal: r.kcal_estimado || 0, prot: r.proteina_g || 0, carb: r.hidratos_g || 0, fat: r.gordura_g || 0, notes: r.descricao || "" });
      saveData();
      toast("Guardado nas tuas receitas 📁");
    });
  }

  // =========================================================
  // ARRANQUE
  // =========================================================
  function launchApp() {
    onboardEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    fillProfileForm();
    showScreen("dashboard");
  }

  if (data.onboarded) launchApp();

  // Registo do Service Worker (PWA)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("SW falhou:", e));
    });
  }
})();
