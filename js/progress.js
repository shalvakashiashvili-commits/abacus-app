// პროგრესი და პარამეტრები localStorage-ში. ყოველი წაკითხვა/ჩაწერა try/catch-შია.
// storage შეიძლება გადაეცეს (ტესტებში — მეხსიერებაში მომუშავე ობიექტი).

import { LEVELS, getLevel, prevBuilt } from './levels.js';
import { problemKey } from './generator.js';

export const PROGRESS_KEY = 'abacus.progress.v1';
export const SETTINGS_KEY = 'abacus.settings.v1';
export const DATA_VERSION = 1;
const MAX_MISTAKES = 200;
const MAX_DAYS = 400;

export const DEFAULT_SETTINGS = {
  theme: 'auto',        // 'auto' | 'light' | 'dark'
  columnSpeed: 3,       // წამი თითო რიცხვზე სვეტურ ჯამში
  flashSpeed: 1.5,      // წამი თითო რიცხვზე flash anzan-ში (90%+-ის შემდეგ ავტომატურად მცირდება)
  showValue: true,      // მნიშვნელობის ჩვენება ნაგულისხმევად (თავისუფალ სორობანზე)
  dailyGoalMin: 20,
  examTimeMode: 'extended' // „კენტეის მსგავსი“ გამოცდა: 'extended' (×1,5) ან 'official'
};

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); }
  };
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const t = '__abacus_test__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return localStorage;
    }
  } catch (e) {
    // localStorage მიუწვდომელია (მაგ. პრივატული რეჟიმი) — ვმუშაობთ მეხსიერებაში
  }
  return memoryStorage();
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta, 12);
  return dayKey(dt);
}

function emptyLevel() {
  return {
    lessonDone: false, lessonStep: 0, guidedDone: false,
    tasksRuns: 0, tasksBest: 0, testRuns: 0, testBest: null,
    passed: false, passedAt: null,
    answered: 0, correct: 0, ms: 0
  };
}

function emptyDay() {
  return { answered: 0, correct: 0, ms: 0, plan: {} };
}

export function emptyProgress() {
  return { version: DATA_VERSION, createdAt: new Date().toISOString(), levels: {}, days: {}, mistakes: [] };
}

export function validateProgress(obj) {
  if (!obj || typeof obj !== 'object') return 'ფაილი არ შეიცავს პროგრესის მონაცემებს';
  if (typeof obj.version !== 'number') return 'ვერსია არ არის მითითებული';
  if (obj.version > DATA_VERSION) return 'ფაილი აპლიკაციის უფრო ახალი ვერსიიდანაა';
  if (!obj.levels || typeof obj.levels !== 'object' || Array.isArray(obj.levels)) return 'დონეების მონაცემები არასწორია';
  if (!obj.days || typeof obj.days !== 'object' || Array.isArray(obj.days)) return 'დღეების მონაცემები არასწორია';
  if (!Array.isArray(obj.mistakes)) return 'შეცდომების სია არასწორია';
  for (const m of obj.mistakes) {
    if (!m || typeof m !== 'object' || !m.problem || typeof m.problem.kind !== 'string') return 'შეცდომების სიაში არასწორი ჩანაწერია';
  }
  return null;
}

function readJSON(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJSON(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export class Progress {
  constructor(storage = defaultStorage(), now = () => new Date()) {
    this.storage = storage;
    this.now = now;
    const loaded = readJSON(storage, PROGRESS_KEY);
    this.data = loaded && !validateProgress(loaded) ? loaded : emptyProgress();
    const s = readJSON(storage, SETTINGS_KEY);
    this.settings = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
    this.lastSaveOk = true;
  }

  save() {
    this.lastSaveOk = writeJSON(this.storage, PROGRESS_KEY, this.data);
    return this.lastSaveOk;
  }

  saveSettings() {
    return writeJSON(this.storage, SETTINGS_KEY, this.settings);
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  today() {
    return dayKey(this.now());
  }

  day(key = this.today()) {
    if (!this.data.days[key]) this.data.days[key] = emptyDay();
    const d = this.data.days[key];
    if (!d.plan) d.plan = {};
    return d;
  }

  level(id) {
    const k = String(id);
    if (!this.data.levels[k]) this.data.levels[k] = emptyLevel();
    return { ...emptyLevel(), ...this.data.levels[k] };
  }

  updateLevel(id, patch) {
    const k = String(id);
    this.data.levels[k] = { ...this.level(id), ...patch };
    this.save();
  }

  isPassed(id) {
    return !!this.data.levels[String(id)]?.passed;
  }

  isUnlocked(id) {
    const lvl = getLevel(id);
    if (!lvl || !lvl.built) return false;
    if (lvl.requires !== undefined) return this.isPassed(lvl.requires);
    const prev = prevBuilt(lvl.id);
    return prev ? this.isPassed(prev.id) : true;
  }

  // პირველი აწყობილი, გახსნილი და ჯერ გაუვლელი დონე (null — თუ ეტაპის ყველა დონე გავლილია)
  currentLevelId() {
    for (const l of LEVELS) {
      if (!l.built || l.optional) continue;
      if (!this.isPassed(l.id)) return this.isUnlocked(l.id) ? l.id : null;
    }
    return null;
  }

  passedLevels() {
    return LEVELS.filter((l) => l.built && this.isPassed(l.id)).map((l) => l.id);
  }

  markLessonStep(id, step) {
    const lv = this.level(id);
    this.updateLevel(id, { lessonStep: Math.max(0, step) });
    return lv;
  }

  markLessonDone(id) {
    this.updateLevel(id, { lessonDone: true });
    this.markPlan('learn');
  }

  addTime(ms) {
    if (!(ms > 0)) return;
    const d = this.day();
    d.ms += Math.min(ms, 10 * 60 * 1000);
    this.pruneDays();
    this.save();
  }

  recordAnswer({ level, mode, problem, correct, ms, mistakeId }) {
    const d = this.day();
    d.answered += 1;
    if (correct) d.correct += 1;
    const t = Math.max(0, Math.min(ms || 0, 10 * 60 * 1000));
    d.ms += t;
    const lv = this.level(level);
    this.data.levels[String(level)] = {
      ...lv,
      answered: lv.answered + 1,
      correct: lv.correct + (correct ? 1 : 0),
      ms: lv.ms + t
    };
    if (problem && problem.kind) {
      if (!this.data.kinds || typeof this.data.kinds !== 'object') this.data.kinds = {};
      const k = this.data.kinds[problem.kind] || { answered: 0, correct: 0, ms: 0 };
      this.data.kinds[problem.kind] = { answered: k.answered + 1, correct: k.correct + (correct ? 1 : 0), ms: k.ms + t };
    }
    if (mistakeId) this.resolveMistake(mistakeId, correct);
    else if (!correct && problem) this.addMistake(problem, level);
    this.pruneDays();
    this.save();
  }

  addMistake(problem, level) {
    const today = this.today();
    const clean = { ...problem };
    delete clean.mistakeId;
    const key = problemKey(clean);
    const existing = this.data.mistakes.find((m) => problemKey(m.problem) === key);
    if (existing) {
      existing.wrong += 1;
      existing.right = 0;
      existing.lastDay = today;
    } else {
      this.data.mistakes.push({
        id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        level, problem: clean, addedDay: today, lastDay: today, wrong: 1, right: 0
      });
      if (this.data.mistakes.length > MAX_MISTAKES) this.data.mistakes.splice(0, this.data.mistakes.length - MAX_MISTAKES);
    }
  }

  // შეცდომა სიიდან ქრება, როცა სხვადასხვა დროს ორჯერ სწორად ამოიხსნება
  resolveMistake(id, correct) {
    const m = this.data.mistakes.find((x) => x.id === id);
    if (!m) return;
    m.lastDay = this.today();
    if (correct) {
      m.right += 1;
      if (m.right >= 2) this.data.mistakes = this.data.mistakes.filter((x) => x.id !== id);
    } else {
      m.wrong += 1;
      m.right = 0;
    }
  }

  // შეცდომები, რომლებიც დღეს ჯერ არ გამოჩენილა (ანუ წინა სესიებიდანაა)
  dueMistakes(limit = 10) {
    const today = this.today();
    return this.data.mistakes
      .filter((m) => m.lastDay < today)
      .sort((a, b) => (a.lastDay < b.lastDay ? -1 : a.lastDay > b.lastDay ? 1 : b.wrong - a.wrong))
      .slice(0, limit);
  }

  recordSession({ level, mode, accuracy, avgSec, passed }) {
    const lv = this.level(level);
    const patch = {};
    if (mode === 'guided') {
      patch.guidedDone = true;
      this.markPlan('learn');
    } else if (mode === 'tasks') {
      patch.tasksRuns = lv.tasksRuns + 1;
      patch.tasksBest = Math.max(lv.tasksBest || 0, accuracy);
      this.markPlan('tasks');
    } else if (mode === 'test') {
      patch.testRuns = lv.testRuns + 1;
      patch.testBest = lv.testBest == null ? accuracy : Math.max(lv.testBest, accuracy);
      if (passed && !lv.passed) {
        patch.passed = true;
        patch.passedAt = this.today();
      }
      this.markPlan('learn');
    } else if (mode === 'review') {
      this.markPlan('review');
    }
    this.data.levels[String(level)] = { ...lv, ...patch };
    this.save();
  }

  // „კენტეის მსგავსი“ გამოცდის შედეგი
  addExam(entry) {
    if (!Array.isArray(this.data.exams)) this.data.exams = [];
    this.data.exams.push({ ...entry, day: this.today() });
    if (this.data.exams.length > 100) this.data.exams.splice(0, this.data.exams.length - 100);
    this.markPlan('learn');
    this.save();
  }

  bestExam(gradeId) {
    const list = (this.data.exams || []).filter((e) => e.grade === gradeId);
    return list.length ? list.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  }

  markPlan(block) {
    const d = this.day();
    d.plan[block] = true;
    this.save();
  }

  isActiveDay(key) {
    const d = this.data.days[key];
    return !!d && (d.answered > 0 || d.ms > 0);
  }

  // დღეების სერია: ზედიზედ აქტიური დღეები დღემდე (ან გუშინდლამდე, თუ დღეს ჯერ არ გივარჯიშია)
  streak() {
    let key = this.today();
    if (!this.isActiveDay(key)) key = shiftDay(key, -1);
    let n = 0;
    while (this.isActiveDay(key)) {
      n += 1;
      key = shiftDay(key, -1);
    }
    return n;
  }

  bestStreak() {
    const keys = Object.keys(this.data.days).filter((k) => this.isActiveDay(k)).sort();
    let best = 0, cur = 0, prev = null;
    for (const k of keys) {
      cur = prev && shiftDay(prev, 1) === k ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = k;
    }
    return best;
  }

  totals() {
    let answered = 0, correct = 0, ms = 0;
    for (const k of Object.keys(this.data.levels)) {
      const l = this.data.levels[k];
      answered += l.answered || 0;
      correct += l.correct || 0;
      ms += l.ms || 0;
    }
    return {
      answered, correct,
      accuracy: answered ? correct / answered : null,
      avgSec: answered ? ms / answered / 1000 : null
    };
  }

  lastDays(n = 14) {
    const out = [];
    let key = this.today();
    for (let i = 0; i < n; i++) {
      const d = this.data.days[key] || emptyDay();
      out.unshift({ key, ...d });
      key = shiftDay(key, -1);
    }
    return out;
  }

  pruneDays() {
    const keys = Object.keys(this.data.days).sort();
    if (keys.length > MAX_DAYS) {
      for (const k of keys.slice(0, keys.length - MAX_DAYS)) delete this.data.days[k];
    }
  }

  exportJSON() {
    return JSON.stringify({
      app: 'abacus',
      exportedAt: new Date().toISOString(),
      progress: this.data,
      settings: this.settings
    }, null, 2);
  }

  importJSON(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'ფაილი JSON ფორმატში არ არის' };
    }
    const progress = obj && obj.progress ? obj.progress : obj;
    const err = validateProgress(progress);
    if (err) return { ok: false, error: err };
    this.data = progress;
    if (obj.settings && typeof obj.settings === 'object') {
      this.settings = { ...DEFAULT_SETTINGS, ...obj.settings };
      this.saveSettings();
    }
    const ok = this.save();
    return ok ? { ok: true } : { ok: false, error: 'მონაცემების შენახვა ვერ მოხერხდა' };
  }

  reset() {
    this.data = emptyProgress();
    this.save();
  }
}
