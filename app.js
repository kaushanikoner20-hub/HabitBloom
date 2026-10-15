const STORAGE_KEY = 'habitbloom-data-v1';
const colors = ['sage', 'peach', 'blue', 'lilac', 'gold'];
const categories = {
  sage: 'Wellbeing',
  peach: 'Mindfulness',
  blue: 'Movement',
  lilac: 'Learning',
  gold: 'Daily ritual'
};
const initialHabits = [
  { id: 'water', name: 'Drink 8 glasses of water', color: 'blue' },
  { id: 'reading', name: 'Read for 20 minutes', color: 'sage' },
  { id: 'stretch', name: 'Morning stretch', color: 'peach' },
  { id: 'journal', name: 'Write in my journal', color: 'lilac' },
  { id: 'outside', name: 'Get outside for a walk', color: 'gold' }
];

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDate(date, amount) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.habits) && saved.completions && typeof saved.completions === 'object') {
      return { habits: saved.habits, completions: saved.completions };
    }
  } catch (error) {
    console.warn('HabitBloom could not read saved data.', error);
  }
  return { habits: initialHabits.map((habit) => ({ ...habit })), completions: {} };
}

const data = loadData();
let selectedDate = new Date();
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let selectedColor = colors[0];
let toastTimeout;

const elements = {
  topbarDate: document.querySelector('#topbar-date'),
  fullDate: document.querySelector('#full-date'),
  completedCount: document.querySelector('#completed-count'),
  totalCount: document.querySelector('#total-count'),
  bestStreak: document.querySelector('#best-streak'),
  progressPercent: document.querySelector('#progress-percent'),
  progressFill: document.querySelector('#progress-fill'),
  selectedDayLabel: document.querySelector('#selected-day-label'),
  selectedDaySubtitle: document.querySelector('#selected-day-subtitle'),
  habitList: document.querySelector('#habit-list'),
  emptyState: document.querySelector('#empty-state'),
  finishNote: document.querySelector('#finish-note'),
  calendarDays: document.querySelector('#calendar-days'),
  monthTitle: document.querySelector('#month-title'),
  weekChart: document.querySelector('#week-chart'),
  weekTotal: document.querySelector('#week-total'),
  weekCaptionValue: document.querySelector('#week-caption-value'),
  weekFill: document.querySelector('#week-fill'),
  dialog: document.querySelector('#habit-dialog'),
  form: document.querySelector('#habit-form'),
  habitName: document.querySelector('#habit-name'),
  toast: document.querySelector('#toast')
};

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    showToast('Could not save changes in this browser.');
    console.warn('HabitBloom could not save data.', error);
  }
}

function completedIds(date = selectedDate) {
  return data.completions[localDateKey(date)] || [];
}

function completionCount(date) {
  const completions = data.completions[localDateKey(date)] || [];
  return data.habits.reduce((count, habit) => count + Number(completions.includes(habit.id)), 0);
}

function completionPercent(date) {
  return data.habits.length ? Math.round((completionCount(date) / data.habits.length) * 100) : 0;
}

function habitStreak(habit, throughDate = selectedDate) {
  let cursor = new Date(throughDate);
  const today = localDateKey(new Date());
  const cursorKey = localDateKey(cursor);
  const doneToday = (data.completions[cursorKey] || []).includes(habit.id);
  if (cursorKey === today && !doneToday) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while ((data.completions[localDateKey(cursor)] || []).includes(habit.id)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function getBestStreak() {
  return data.habits.reduce((best, habit) => {
    const dates = Object.keys(data.completions)
      .filter((key) => data.completions[key].includes(habit.id))
      .sort();
    let current = 0;
    let previous = null;
    dates.forEach((key) => {
      const timestamp = Date.parse(`${key}T00:00:00Z`);
      current = previous !== null && timestamp - previous === 86400000 ? current + 1 : 1;
      best = Math.max(best, current);
      previous = timestamp;
    });
    return best;
  }, 0);
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function updateDateLabels() {
  const todayKey = localDateKey(new Date());
  const selectedKey = localDateKey(selectedDate);
  const isToday = selectedKey === todayKey;
  elements.topbarDate.textContent = isToday ? 'TODAY' : formatDate(selectedDate, { month: 'short', day: 'numeric' }).toUpperCase();
  elements.fullDate.textContent = formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  elements.selectedDayLabel.textContent = isToday ? 'Today' : formatDate(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' });
  elements.selectedDaySubtitle.textContent = isToday ? 'Your day, your pace' : formatDate(selectedDate, { month: 'long', day: 'numeric', year: 'numeric' });
  document.querySelector('#next-day').disabled = selectedKey >= todayKey;
}

function renderHabits() {
  const completed = completedIds();
  elements.habitList.replaceChildren();
  elements.emptyState.hidden = data.habits.length > 0;
  elements.finishNote.hidden = data.habits.length === 0 || completed.length < data.habits.length;

  data.habits.forEach((habit, index) => {
    const isDone = completed.includes(habit.id);
    const row = document.createElement('article');
    row.className = 'habit-row';
    row.style.animationDelay = `${index * 35}ms`;

    const symbol = document.createElement('span');
    symbol.className = `habit-symbol ${colors.includes(habit.color) ? habit.color : 'sage'}`;
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = habit.name.trim().charAt(0).toUpperCase();

    const copy = document.createElement('div');
    copy.className = 'habit-copy';
    const name = document.createElement('p');
    name.className = 'habit-name';
    name.textContent = habit.name;
    const category = document.createElement('span');
    category.className = 'habit-category';
    category.textContent = categories[habit.color] || 'Daily ritual';
    copy.append(name, category);

    const streak = document.createElement('span');
    streak.className = 'streak-badge';
    streak.innerHTML = `<span class="streak-spark" aria-hidden="true">✳</span>${habitStreak(habit)} day${habitStreak(habit) === 1 ? '' : 's'}`;

    const toggle = document.createElement('button');
    toggle.className = `habit-toggle${isDone ? ' checked' : ''}`;
    toggle.type = 'button';
    toggle.setAttribute('aria-label', `${isDone ? 'Mark incomplete' : 'Complete'}: ${habit.name}`);
    toggle.setAttribute('aria-pressed', String(isDone));
    toggle.addEventListener('click', () => toggleHabit(habit.id));

    const more = document.createElement('button');
    more.className = 'habit-more';
    more.type = 'button';
    more.setAttribute('aria-label', `Options for ${habit.name}`);
    more.setAttribute('aria-expanded', 'false');
    more.textContent = '···';
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      const existing = row.querySelector('.habit-menu');
      document.querySelectorAll('.habit-menu').forEach((menu) => menu.remove());
      if (existing) {
        more.setAttribute('aria-expanded', 'false');
        return;
      }
      const menu = document.createElement('div');
      menu.className = 'habit-menu';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove habit';
      remove.addEventListener('click', () => removeHabit(habit.id));
      menu.append(remove);
      row.append(menu);
      more.setAttribute('aria-expanded', 'true');
    });

    row.append(symbol, copy, streak, toggle, more);
    elements.habitList.append(row);
  });
}

function toggleHabit(habitId) {
  const key = localDateKey(selectedDate);
  const next = new Set(data.completions[key] || []);
  if (next.has(habitId)) next.delete(habitId);
  else next.add(habitId);
  data.completions[key] = [...next];
  saveData();
  render();
  if (next.has(habitId)) showToast('A little win, planted.');
}

function removeHabit(habitId) {
  const habit = data.habits.find((item) => item.id === habitId);
  data.habits = data.habits.filter((item) => item.id !== habitId);
  Object.keys(data.completions).forEach((key) => {
    data.completions[key] = data.completions[key].filter((id) => id !== habitId);
    if (data.completions[key].length === 0) delete data.completions[key];
  });
  saveData();
  render();
  showToast(`Removed ${habit.name}.`);
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const todayKey = localDateKey(new Date());
  const selectedKey = localDateKey(selectedDate);
  const currentMonth = new Date();
  elements.monthTitle.textContent = formatDate(visibleMonth, { month: 'long', year: 'numeric' });
  document.querySelector('#next-month').disabled = visibleMonth.getFullYear() > currentMonth.getFullYear()
    || (visibleMonth.getFullYear() === currentMonth.getFullYear() && visibleMonth.getMonth() >= currentMonth.getMonth());
  elements.calendarDays.replaceChildren();

  for (let cell = 0; cell < offset; cell += 1) {
    const empty = document.createElement('span');
    empty.className = 'calendar-day empty';
    empty.setAttribute('aria-hidden', 'true');
    elements.calendarDays.append(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    const button = document.createElement('button');
    button.className = 'calendar-day';
    button.type = 'button';
    button.setAttribute('role', 'gridcell');
    button.textContent = String(day);
    button.setAttribute('aria-label', `${formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}, ${completionCount(date)} of ${data.habits.length} habits complete`);
    if (key === todayKey) button.classList.add('today');
    if (key === selectedKey) button.classList.add('selected');
    const percentage = completionPercent(date);
    if (percentage > 0 && percentage < 50) button.classList.add('activity-low');
    else if (percentage >= 50 && percentage < 100) button.classList.add('activity-mid');
    else if (percentage === 100 && data.habits.length > 0) button.classList.add('activity-full');
    if (key > todayKey) {
      button.disabled = true;
      button.setAttribute('aria-label', `${formatDate(date, { month: 'long', day: 'numeric' })}, future date`);
    } else {
      button.addEventListener('click', () => {
        selectedDate = date;
        render();
      });
    }
    elements.calendarDays.append(button);
  }
}

function renderWeek() {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = shiftDate(today, -mondayOffset);
  const totalPossible = data.habits.length * (mondayOffset + 1);
  let completedTotal = 0;
  elements.weekChart.replaceChildren();

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = shiftDate(monday, dayIndex);
    const future = localDateKey(date) > localDateKey(today);
    const count = future ? 0 : completionCount(date);
    completedTotal += count;
    const percent = data.habits.length ? (count / data.habits.length) * 100 : 0;
    const day = document.createElement('div');
    day.className = 'week-day';
    if (percent > 0) day.classList.add('completed');
    if (localDateKey(date) === localDateKey(today)) day.classList.add('current');
    day.setAttribute('aria-label', `${formatDate(date, { weekday: 'long' })}: ${count} habits completed`);

    const area = document.createElement('div');
    area.className = 'week-bar-area';
    const bar = document.createElement('span');
    bar.className = 'week-bar';
    bar.style.height = `${Math.max(percent, 4)}%`;
    area.append(bar);
    const label = document.createElement('span');
    label.className = 'week-day-label';
    label.textContent = formatDate(date, { weekday: 'short' }).slice(0, 1);
    day.append(area, label);
    elements.weekChart.append(day);
  }

  const percentage = totalPossible ? Math.round((completedTotal / totalPossible) * 100) : 0;
  elements.weekTotal.textContent = `${percentage}%`;
  elements.weekCaptionValue.textContent = `${percentage}%`;
  elements.weekFill.style.width = `${percentage}%`;
}

function renderSummary() {
  const completed = completionCount(selectedDate);
  const total = data.habits.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  elements.completedCount.textContent = String(completed);
  elements.totalCount.textContent = String(total);
  elements.bestStreak.textContent = String(getBestStreak());
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressFill.style.width = `${percent}%`;
}

function render() {
  updateDateLabels();
  renderSummary();
  renderHabits();
  renderCalendar();
  renderWeek();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => elements.toast.classList.remove('visible'), 2200);
}

function openDialog() {
  elements.form.reset();
  selectedColor = colors[0];
  document.querySelector('#color-sage').checked = true;
  elements.dialog.showModal();
  elements.habitName.focus();
}

function makeColorOptions() {
  const container = document.querySelector('#color-options');
  colors.forEach((color, index) => {
    const label = document.createElement('label');
    label.className = `color-choice ${color}`;
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'color';
    input.id = `color-${color}`;
    input.value = color;
    input.checked = index === 0;
    input.addEventListener('change', () => { selectedColor = color; });
    const swatch = document.createElement('i');
    swatch.setAttribute('aria-hidden', 'true');
    label.append(input, swatch);
    container.append(label);
  });
}

document.querySelector('#add-habit-button').addEventListener('click', openDialog);
document.querySelector('#close-dialog').addEventListener('click', () => elements.dialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => elements.dialog.close());
elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});
elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = elements.habitName.value.trim();
  if (!name) return;
  data.habits.push({ id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, color: selectedColor });
  saveData();
  elements.dialog.close();
  render();
  showToast('Your new habit is ready to grow.');
});
document.querySelector('#previous-day').addEventListener('click', () => {
  selectedDate = shiftDate(selectedDate, -1);
  visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  render();
});
document.querySelector('#next-day').addEventListener('click', () => {
  if (localDateKey(selectedDate) >= localDateKey(new Date())) return;
  selectedDate = shiftDate(selectedDate, 1);
  visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  render();
});
document.querySelector('#jump-today').addEventListener('click', () => {
  selectedDate = new Date();
  visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  render();
});
document.querySelector('#previous-month').addEventListener('click', () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.querySelector('#next-month').addEventListener('click', () => {
  const currentMonth = new Date();
  if (visibleMonth.getFullYear() > currentMonth.getFullYear() || (visibleMonth.getFullYear() === currentMonth.getFullYear() && visibleMonth.getMonth() >= currentMonth.getMonth())) return;
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendar();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.habit-more')) {
    document.querySelectorAll('.habit-menu').forEach((menu) => menu.remove());
    document.querySelectorAll('.habit-more[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  }
});

makeColorOptions();
render();