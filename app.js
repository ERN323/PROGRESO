// Global state variables
let logsData = [];
let chartInstance = null;
let currentTheme = 'purple';

// Active session variables
let activeSession = {
  date: '',
  exercises: [], // { name, plannedSets, actualSets: [{weight, reps}] }
  restTime: 60,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  timerInterval: null
};

// State enum
const AppState = {
  WELCOME: 'screen-welcome',
  PLAN_EXERCISES: 'screen-plan-exercises',
  PLAN_REST: 'screen-plan-rest',
  WAIT_REPS: 'screen-track-wait-reps',
  TIMER: 'screen-track-timer',
  SUMMARY: 'screen-summary'
};

// UI Elements
const screens = {
  [AppState.WELCOME]: document.getElementById('screen-welcome'),
  [AppState.PLAN_EXERCISES]: document.getElementById('screen-plan-exercises'),
  [AppState.PLAN_REST]: document.getElementById('screen-plan-rest'),
  [AppState.WAIT_REPS]: document.getElementById('screen-track-wait-reps'),
  [AppState.TIMER]: document.getElementById('screen-track-timer'),
  [AppState.SUMMARY]: document.getElementById('screen-summary')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadLogsFromStorage();
  setupEventListeners();
  updateDateDisplays();
  updateDashboard();
});

// Setup date display formatted as DD.MM.YYYY
function updateDateDisplays() {
  const todayStr = getTodayDateString();
  const dateBadge = document.getElementById('welcome-date');
  if (dateBadge) dateBadge.textContent = todayStr;
}

function getTodayDateString() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Accent Color Theme Handler
function loadTheme() {
  const savedTheme = localStorage.getItem('flextrack-theme');
  if (savedTheme) {
    currentTheme = savedTheme;
    document.body.className = `theme-${savedTheme}`;
    
    // Update active state in UI
    document.querySelectorAll('.theme-dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.theme === savedTheme);
    });
  }
}

function selectTheme(themeName) {
  currentTheme = themeName;
  document.body.className = `theme-${themeName}`;
  localStorage.setItem('flextrack-theme', themeName);
  
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.theme === themeName);
  });
  
  // Re-draw chart to match new neon colors
  if (chartInstance) {
    drawChart();
  }
}

// Persistent Storage Handlers
function loadLogsFromStorage() {
  const stored = localStorage.getItem('flextrack-logs');
  if (stored) {
    try {
      logsData = JSON.parse(stored);
    } catch (e) {
      console.error('Error loading stored logs:', e);
      logsData = [];
    }
  } else {
    // Seed with user's historical spreadsheet data
    logsData = [
      {"Date":"07.05.2026","Name of Exercise":"Kettlebell Goblet Squats","1 (kg)":"24","1 (reps)":"12","2 (kg)":"24","2 (reps)":"12","3 (kg)":"24","3 (reps)":"12","4 (kg)":"24","4 (reps)":"12"},
      {"Date":"07.05.2026","Name of Exercise":"Barbell Rows","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"12","4 (kg)":"40","4 (reps)":"9"},
      {"Date":"07.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"16","1 (reps)":"12","2 (kg)":"16","2 (reps)":"12","3 (kg)":"16","3 (reps)":"12","4 (kg)":"18","4 (reps)":"9"},
      {"Date":"07.05.2026","Name of Exercise":"Shoulder Press","1 (kg)":"12","1 (reps)":"12","2 (kg)":"12","2 (reps)":"10","3 (kg)":"12","3 (reps)":"9"},
      {"Date":"07.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"09.05.2026","Name of Exercise":"Kettlebell Goblet Squats","1 (kg)":"24","1 (reps)":"12","2 (kg)":"28","2 (reps)":"12","3 (kg)":"28","3 (reps)":"12","4 (kg)":"28","4 (reps)":"12"},
      {"Date":"09.05.2026","Name of Exercise":"Barbell Rows","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"12","4 (kg)":"40","4 (reps)":"9"},
      {"Date":"09.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"16","1 (reps)":"12","2 (kg)":"18","2 (reps)":"12","3 (kg)":"18","3 (reps)":"10","4 (kg)":"18","4 (reps)":"8"},
      {"Date":"09.05.2026","Name of Exercise":"Shoulder Press","1 (kg)":"12","1 (reps)":"10","2 (kg)":"10","2 (reps)":"12","3 (kg)":"10","3 (reps)":"11"},
      {"Date":"09.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"11.05.2026","Name of Exercise":"Kettlebell Goblet Squats","1 (kg)":"28","1 (reps)":"12","2 (kg)":"28","2 (reps)":"12","3 (kg)":"28","3 (reps)":"12","4 (kg)":"28","4 (reps)":"12"},
      {"Date":"11.05.2026","Name of Exercise":"Barbell Rows","1 (kg)":"30","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"12","4 (kg)":"40","4 (reps)":"9"},
      {"Date":"11.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"18","2 (reps)":"12","3 (kg)":"18","3 (reps)":"12","4 (kg)":"18","4 (reps)":"12"},
      {"Date":"11.05.2026","Name of Exercise":"Shoulder Press","1 (kg)":"12","1 (reps)":"12","2 (kg)":"12","2 (reps)":"9","3 (kg)":"10","3 (reps)":"12","4 (kg)":"10","4 (reps)":"10"},
      {"Date":"11.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"13.05.2026","Name of Exercise":"Kettlebell Goblet Squats","1 (kg)":"28","1 (reps)":"12","2 (kg)":"28","2 (reps)":"12","3 (kg)":"28","3 (reps)":"12","4 (kg)":"28","4 (reps)":"12"},
      {"Date":"13.05.2026","Name of Exercise":"Barbell Rows","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"12","4 (kg)":"40","4 (reps)":"9"},
      {"Date":"13.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"18","2 (reps)":"12","3 (kg)":"18","3 (reps)":"12","4 (kg)":"18","4 (reps)":"8"},
      {"Date":"13.05.2026","Name of Exercise":"Shoulder Press","1 (kg)":"12","1 (reps)":"12","2 (kg)":"12","2 (reps)":"12","3 (kg)":"12","3 (reps)":"10","4 (kg)":"12","4 (reps)":"11"},
      {"Date":"13.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"15.05.2026","Name of Exercise":"Squats","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"50","3 (reps)":"12","4 (kg)":"50","4 (reps)":"12"},
      {"Date":"15.05.2026","Name of Exercise":"lateral pulldowns","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"11","3 (kg)":"35","3 (reps)":"12","4 (kg)":"35","4 (reps)":"10"},
      {"Date":"15.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"18","2 (reps)":"12","3 (kg)":"18","3 (reps)":"12","4 (kg)":"18","4 (reps)":"10"},
      {"Date":"15.05.2026","Name of Exercise":"lateral raises","1 (kg)":"8","1 (reps)":"10","2 (kg)":"8","2 (reps)":"12","3 (kg)":"8","3 (reps)":"10","4 (kg)":"8","4 (reps)":"10"},
      {"Date":"15.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"18.05.2026","Name of Exercise":"Squats","1 (kg)":"40","1 (reps)":"12","2 (kg)":"50","2 (reps)":"12","3 (kg)":"50","3 (reps)":"12","4 (kg)":"50","4 (reps)":"12"},
      {"Date":"18.05.2026","Name of Exercise":"lateral pulldowns","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"11","3 (kg)":"40","3 (reps)":"12","4 (kg)":"40","4 (reps)":"10"},
      {"Date":"18.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"20","2 (reps)":"12","3 (kg)":"18","3 (reps)":"7/2","4 (kg)":"18","4 (reps)":"10"},
      {"Date":"18.05.2026","Name of Exercise":"lateral raises","1 (kg)":"10","1 (reps)":"12","2 (kg)":"8","2 (reps)":"12","3 (kg)":"8","3 (reps)":"10","4 (kg)":"8","4 (reps)":"10"},
      {"Date":"18.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"20.05.2026","Name of Exercise":"Squats","1 (kg)":"50","1 (reps)":"12","2 (kg)":"55","2 (reps)":"12","3 (kg)":"55","3 (reps)":"12","4 (kg)":"55","4 (reps)":"12"},
      {"Date":"20.05.2026","Name of Exercise":"lateral pulldowns","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"10","4 (kg)":"35","4 (reps)":"12"},
      {"Date":"20.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"20","2 (reps)":"12","3 (kg)":"20","3 (reps)":"12","4 (kg)":"18","4 (reps)":"10"},
      {"Date":"20.05.2026","Name of Exercise":"lateral raises","1 (kg)":"8","1 (reps)":"12","2 (kg)":"8","2 (reps)":"12","3 (kg)":"8","3 (reps)":"12","4 (kg)":"8","4 (reps)":"10"},
      {"Date":"20.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"22.05.2026","Name of Exercise":"Squats","1 (kg)":"50","1 (reps)":"12","2 (kg)":"55","2 (reps)":"12","3 (kg)":"55","3 (reps)":"12","4 (kg)":"55","4 (reps)":"12"},
      {"Date":"22.05.2026","Name of Exercise":"lateral pulldowns","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"10","4 (kg)":"35","4 (reps)":"12"},
      {"Date":"22.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"20","2 (reps)":"12","3 (kg)":"20","3 (reps)":"12","4 (kg)":"18","4 (reps)":"10"},
      {"Date":"22.05.2026","Name of Exercise":"lateral raises","1 (kg)":"8","1 (reps)":"12","2 (kg)":"8","2 (reps)":"12","3 (kg)":"8","3 (reps)":"12","4 (kg)":"8","4 (reps)":"10"},
      {"Date":"22.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"},
      {"Date":"24.05.2026","Name of Exercise":"Squats","1 (kg)":"50","1 (reps)":"12","2 (kg)":"55","2 (reps)":"12","3 (kg)":"55","3 (reps)":"12","4 (kg)":"55","4 (reps)":"12"},
      {"Date":"24.05.2026","Name of Exercise":"lateral pulldowns","1 (kg)":"40","1 (reps)":"12","2 (kg)":"40","2 (reps)":"12","3 (kg)":"40","3 (reps)":"10","4 (kg)":"35","4 (reps)":"12"},
      {"Date":"24.05.2026","Name of Exercise":"Dumbell Bench Press","1 (kg)":"18","1 (reps)":"12","2 (kg)":"20","2 (reps)":"12","3 (kg)":"20","3 (reps)":"12","4 (kg)":"18","4 (reps)":"10"},
      {"Date":"24.05.2026","Name of Exercise":"lateral raises","1 (kg)":"8","1 (reps)":"12","2 (kg)":"8","2 (reps)":"12","3 (kg)":"8","3 (reps)":"12","4 (kg)":"8","4 (reps)":"10"},
      {"Date":"24.05.2026","Name of Exercise":"Halos","1 (kg)":"12","1 (reps)":"20","2 (kg)":"12","2 (reps)":"20","3 (kg)":"12","3 (reps)":"20"}
    ];
    saveLogsToStorage();
  }
}

function saveLogsToStorage() {
  localStorage.setItem('flextrack-logs', JSON.stringify(logsData));
}

// Data Normalization (standardizes sheet parsing output)
function normalizeImportedData(data) {
  return data.map(row => {
    const normalized = {};
    
    // Find exercise name key (case insensitive check)
    const nameKey = Object.keys(row).find(k => 
      k.toLowerCase().includes('exercise') || k.toLowerCase().includes('name')
    ) || 'Name of Exercise';
    
    // Find date key
    const dateKey = Object.keys(row).find(k => 
      k.toLowerCase().includes('date')
    ) || 'Date';
    
    normalized['Date'] = row[dateKey] ? String(row[dateKey]).trim() : '';
    normalized['Name of Exercise'] = row[nameKey] ? String(row[nameKey]).trim() : '';
    
    // Find all weight and reps columns matching e.g., '1 (kg)' or '1 (reps)'
    Object.keys(row).forEach(k => {
      const cleanKey = k.trim();
      const kgMatch = cleanKey.match(/^(\d+)\s*\(kg\)/i);
      const repsMatch = cleanKey.match(/^(\d+)\s*\(reps\)/i);
      
      if (kgMatch) {
        normalized[`${kgMatch[1]} (kg)`] = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
      } else if (repsMatch) {
        normalized[`${repsMatch[1]} (reps)`] = row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
      }
    });
    
    return normalized;
  }).filter(row => row['Date'] && row['Name of Exercise']);
}

function mergeLogs(newData) {
  const normalizedNew = normalizeImportedData(newData);
  
  // Merge logs based on Date + Exercise Name unique key
  const existingMap = new Map();
  logsData.forEach(row => {
    const key = `${row['Date']}||${row['Name of Exercise']}`;
    existingMap.set(key, row);
  });
  
  normalizedNew.forEach(row => {
    const key = `${row['Date']}||${row['Name of Exercise']}`;
    existingMap.set(key, row); // Uploaded spreadsheet overrides or appends
  });
  
  // Convert map back to array and sort chronologically
  logsData = Array.from(existingMap.values());
  sortLogsChronologically();
  saveLogsToStorage();
}

function sortLogsChronologically() {
  logsData.sort((a, b) => {
    const parseDateStr = (str) => {
      const parts = str.split('.');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return new Date(0);
    };
    return parseDateStr(a['Date']) - parseDateStr(b['Date']);
  });
}

// Layout Transition State Machine
function transitionTo(state) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  const target = screens[state];
  if (target) {
    target.classList.add('active');
    
    // Focus adjustments for UX
    if (state === AppState.WAIT_REPS) {
      document.getElementById('set-reps-input').focus();
    }
  }
}

// Event Listeners Configuration
function setupEventListeners() {
  // Theme changes
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => selectTheme(dot.dataset.theme));
  });

  // Spreadsheet Uploader
  const uploader = document.getElementById('spreadsheet-upload');
  uploader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData = XLSX.utils.sheet_to_json(sheet);
        
        if (parsedData.length > 0) {
          mergeLogs(parsedData);
          updateDashboard();
          alert(`Successfully imported ${parsedData.length} records!`);
        } else {
          alert('Spreadsheet is empty or could not be parsed.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse spreadsheet file.');
      }
      uploader.value = ''; // Reset uploader input
    };
    reader.readAsBinaryString(file);
  });

  // CSV Exporter
  document.getElementById('export-btn').addEventListener('click', exportCSV);

  // Welcome Screen actions
  document.getElementById('start-session-btn').addEventListener('click', () => {
    activeSession.date = getTodayDateString();
    activeSession.exercises = [];
    renderPlannedExercisesList();
    transitionTo(AppState.PLAN_EXERCISES);
  });

  // Planner actions
  document.getElementById('plan-add-btn').addEventListener('click', addPlannedExercise);
  document.getElementById('plan-ex-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlannedExercise();
  });
  document.getElementById('cancel-plan-btn').addEventListener('click', () => {
    transitionTo(AppState.WELCOME);
  });
  document.getElementById('confirm-plan-btn').addEventListener('click', () => {
    transitionTo(AppState.PLAN_REST);
  });

  // Rest duration screen
  document.getElementById('back-to-plan-btn').addEventListener('click', () => {
    transitionTo(AppState.PLAN_EXERCISES);
  });
  document.getElementById('start-workout-btn').addEventListener('click', () => {
    const restInput = document.getElementById('planned-rest-seconds');
    activeSession.restTime = parseInt(restInput.value) || 60;
    activeSession.currentExerciseIndex = 0;
    activeSession.currentSetIndex = 0;
    
    startActiveExerciseTracking();
  });

  // Set logging actions
  document.getElementById('log-set-btn').addEventListener('click', logCurrentSet);
  document.getElementById('set-reps-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') logCurrentSet();
  });
  document.getElementById('quit-workout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to quit this workout session? Current progress will not be saved.')) {
      transitionTo(AppState.WELCOME);
    }
  });

  // Timer actions
  document.getElementById('skip-timer-btn').addEventListener('click', skipRestTimer);

  // Summary screen actions
  document.getElementById('finish-workout-btn').addEventListener('click', () => {
    transitionTo(AppState.WELCOME);
  });

  // Chart dropdown filter
  document.getElementById('exercise-chart-selector').addEventListener('change', drawChart);
}

// Planner Screens Implementation
function addPlannedExercise() {
  const nameInput = document.getElementById('plan-ex-name');
  const setsInput = document.getElementById('plan-ex-sets');
  
  const name = nameInput.value.trim();
  const sets = parseInt(setsInput.value) || 4;
  
  if (!name) return;
  
  activeSession.exercises.push({
    name: name,
    plannedSets: sets,
    actualSets: []
  });
  
  nameInput.value = '';
  setsInput.value = '4';
  
  renderPlannedExercisesList();
  nameInput.focus();
}

function removePlannedExercise(index) {
  activeSession.exercises.splice(index, 1);
  renderPlannedExercisesList();
}

function renderPlannedExercisesList() {
  const container = document.getElementById('planned-list');
  const confirmBtn = document.getElementById('confirm-plan-btn');
  container.innerHTML = '';
  
  if (activeSession.exercises.length === 0) {
    container.innerHTML = '<p id="empty-plan-msg" style="text-align: center; color: var(--text-secondary); padding: 20px;">No exercises added yet.</p>';
    confirmBtn.disabled = true;
    return;
  }
  
  confirmBtn.disabled = false;
  activeSession.exercises.forEach((ex, idx) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-info">
        <h4>${ex.name}</h4>
        <p>${ex.plannedSets} planned sets</p>
      </div>
      <button class="btn btn-danger btn-icon" onclick="removePlannedExercise(${idx})" style="width: 32px; height: 32px; border-radius: 8px;">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    `;
    container.appendChild(item);
  });
}

// Active Workout Screens Implementation
function startActiveExerciseTracking() {
  const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
  
  // Update elements
  document.getElementById('active-ex-name').textContent = currentEx.name;
  document.getElementById('active-set-count').textContent = `Set ${activeSession.currentSetIndex + 1} of ${currentEx.plannedSets}`;
  
  // Pre-fill weight with last completed weight for this exercise
  const weightInput = document.getElementById('set-weight-input');
  const lastWeight = findLastUsedWeight(currentEx.name);
  weightInput.value = lastWeight || '';
  
  // Reset rep inputs
  const repsInput = document.getElementById('set-reps-input');
  repsInput.value = '';
  
  transitionTo(AppState.WAIT_REPS);
}

function findLastUsedWeight(exerciseName) {
  // Search backward in logsData for this exercise
  const lowerExName = exerciseName.toLowerCase();
  for (let i = logsData.length - 1; i >= 0; i--) {
    const row = logsData[i];
    if (row['Name of Exercise'] && row['Name of Exercise'].toLowerCase() === lowerExName) {
      // Find the first non-empty set weight
      for (let s = 1; s <= 10; s++) {
        if (row[`${s} (kg)`]) {
          return row[`${s} (kg)`];
        }
      }
    }
  }
  return null;
}

function logCurrentSet() {
  const weightInput = document.getElementById('set-weight-input');
  const repsInput = document.getElementById('set-reps-input');
  
  const weight = parseFloat(weightInput.value) || 0;
  const reps = repsInput.value.trim();
  
  if (!reps) {
    alert('Please enter the reps completed.');
    repsInput.focus();
    return;
  }
  
  const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
  currentEx.actualSets.push({ weight, reps });
  
  // Check if we need to progress to the next set or next exercise
  const isLastSet = activeSession.currentSetIndex === currentEx.plannedSets - 1;
  const isLastExercise = activeSession.currentExerciseIndex === activeSession.exercises.length - 1;
  
  if (isLastSet && isLastExercise) {
    // Workout completed!
    saveCompletedSession();
  } else {
    // Show Rest Timer
    startRestTimer(isLastSet);
  }
}

function startRestTimer(isLastSetOfExercise) {
  transitionTo(AppState.TIMER);
  
  const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
  const nextEx = activeSession.exercises[activeSession.currentExerciseIndex + 1];
  
  document.getElementById('timer-ex-name').textContent = currentEx.name;
  
  const subtext = document.getElementById('timer-next-set');
  if (isLastSetOfExercise) {
    subtext.textContent = `Up Next: ${nextEx.name} (Set 1 of ${nextEx.plannedSets})`;
  } else {
    subtext.textContent = `Up Next: Set ${activeSession.currentSetIndex + 2} of ${currentEx.plannedSets}`;
  }
  
  let timeLeft = activeSession.restTime;
  const countdownText = document.getElementById('timer-countdown');
  const progressRing = document.getElementById('timer-progress-ring');
  
  countdownText.textContent = formatTime(timeLeft);
  
  // Reset circular progress bar stroke offset
  progressRing.style.strokeDashoffset = 0;
  
  clearInterval(activeSession.timerInterval);
  activeSession.timerInterval = setInterval(() => {
    timeLeft--;
    countdownText.textContent = formatTime(timeLeft);
    
    // Circular progress animation (perimeter=502)
    const progressFraction = timeLeft / activeSession.restTime;
    progressRing.style.strokeDashoffset = 502 - (502 * progressFraction);
    
    if (timeLeft <= 0) {
      clearInterval(activeSession.timerInterval);
      playBeep();
      advanceSession(isLastSetOfExercise);
    }
  }, 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m > 0 ? m + ':' : ''}${String(s).padStart(2, '0')}`;
}

function skipRestTimer() {
  clearInterval(activeSession.timerInterval);
  const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
  const isLastSet = activeSession.currentSetIndex === currentEx.plannedSets - 1;
  advanceSession(isLastSet);
}

function advanceSession(isLastSetOfExercise) {
  if (isLastSetOfExercise) {
    activeSession.currentExerciseIndex++;
    activeSession.currentSetIndex = 0;
  } else {
    activeSession.currentSetIndex++;
  }
  
  startActiveExerciseTracking();
}

// Programmatic Web Audio Synthesizer Beep
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 pitch
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.warn('Audio feedback failed to execute:', e);
  }
}

// Summary Screen Implementation
function saveCompletedSession() {
  // Convert activeSession exercises into spreadsheet-compliant rows
  const newRows = activeSession.exercises.map(ex => {
    const row = {
      'Date': activeSession.date,
      'Name of Exercise': ex.name
    };
    
    ex.actualSets.forEach((set, sIdx) => {
      row[`${sIdx + 1} (kg)`] = set.weight !== 0 ? String(set.weight) : '';
      row[`${sIdx + 1} (reps)`] = String(set.reps);
    });
    
    return row;
  });
  
  // Merge with our logs database
  mergeLogs(newRows);
  
  // Update Summary counts
  document.getElementById('summary-exercises-count').textContent = activeSession.exercises.length;
  let totalSets = 0;
  activeSession.exercises.forEach(ex => totalSets += ex.actualSets.length);
  document.getElementById('summary-sets-count').textContent = totalSets;
  
  // Refresh views
  updateDashboard();
  
  transitionTo(AppState.SUMMARY);
}

// Dashboard & Visualizations (Chart.js)
function updateDashboard() {
  populateExerciseSelect();
  renderLogsTable();
  populateExerciseAutocomplete();
  drawChart();
}

function populateExerciseSelect() {
  const select = document.getElementById('exercise-chart-selector');
  const currentValue = select.value;
  
  // Extract unique exercise names
  const exercises = [...new Set(logsData.map(r => r['Name of Exercise']))].filter(Boolean);
  exercises.sort();
  
  select.innerHTML = '<option value="">Select Exercise</option>';
  exercises.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });
  
  // Restore selection if it still exists
  if (exercises.includes(currentValue)) {
    select.value = currentValue;
  } else if (exercises.length > 0) {
    // Default to first exercise
    select.value = exercises[0];
  }
}

function populateExerciseAutocomplete() {
  const datalist = document.getElementById('ex-autocomplete');
  const exercises = [...new Set(logsData.map(r => r['Name of Exercise']))].filter(Boolean);
  exercises.sort();
  
  datalist.innerHTML = '';
  exercises.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex;
    datalist.appendChild(opt);
  });
}

function renderLogsTable() {
  const tbody = document.getElementById('log-table-body');
  tbody.innerHTML = '';
  
  if (logsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 40px 0;">
          No workout logs loaded. Use the "Import Spreadsheet" button above to upload your history.
        </td>
      </tr>
    `;
    return;
  }
  
  // Display latest logs first
  const displayLogs = [...logsData].reverse();
  
  displayLogs.forEach(row => {
    const tr = document.createElement('tr');
    
    // Date & Exercise
    const dateTd = document.createElement('td');
    dateTd.textContent = row['Date'] || '';
    tr.appendChild(dateTd);
    
    const exTd = document.createElement('td');
    exTd.textContent = row['Name of Exercise'] || '';
    exTd.style.fontWeight = '600';
    tr.appendChild(exTd);
    
    // Sets (Col 3-6)
    for (let s = 1; s <= 4; s++) {
      const td = document.createElement('td');
      const kg = row[`${s} (kg)`];
      const reps = row[`${s} (reps)`];
      
      if (kg !== undefined && kg !== '' && reps !== undefined && reps !== '') {
        td.innerHTML = `<span style="color:var(--text-primary); font-weight:600;">${kg}</span> <span style="color:var(--text-secondary); font-size:0.8rem;">kg</span> × <span style="color:var(--accent-color); font-weight:600;">${reps}</span>`;
      } else if (reps !== undefined && reps !== '') {
        // Handle set containing reps only (no weight)
        td.innerHTML = `<span style="color:var(--accent-color); font-weight:600;">${reps}</span> <span style="color:var(--text-secondary); font-size:0.8rem;">reps</span>`;
      } else {
        td.textContent = '—';
        td.style.color = 'var(--text-secondary)';
        td.style.opacity = '0.4';
      }
      tr.appendChild(td);
    }
    
    tbody.appendChild(tr);
  });
}

function calculateOneRepMax(weight, repsStr) {
  // Parse reps. If composite string like '7/2', grab first numeric digit.
  const reps = parseInt(String(repsStr).match(/\d+/)) || 0;
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  // Epley 1RM formula
  return weight * (1 + reps / 30);
}

function drawChart() {
  const selectedEx = document.getElementById('exercise-chart-selector').value;
  const placeholder = document.getElementById('chart-placeholder-msg');
  const canvas = document.getElementById('progressChart');
  
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  
  if (!selectedEx || logsData.length === 0) {
    placeholder.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  
  placeholder.style.display = 'none';
  canvas.style.display = 'block';
  
  // Filter and parse logs for selected exercise
  const exerciseLogs = logsData.filter(r => 
    r['Name of Exercise'] && r['Name of Exercise'].toLowerCase() === selectedEx.toLowerCase()
  );
  
  if (exerciseLogs.length === 0) {
    placeholder.style.display = 'block';
    canvas.style.display = 'none';
    return;
  }
  
  // Parse dates and calculate metrics
  const labels = [];
  const oneRmValues = [];
  const volumeValues = [];
  
  exerciseLogs.forEach(row => {
    labels.push(row['Date']);
    
    let max1RM = 0;
    let totalVolume = 0;
    
    // Loop through all sets in row
    let setIndex = 1;
    while (true) {
      const kgKey = `${setIndex} (kg)`;
      const repsKey = `${setIndex} (reps)`;
      
      // Stop checking if no keys exist anymore for this set index (check at least up to 4)
      if (row[kgKey] === undefined && row[repsKey] === undefined && setIndex > 4) {
        break;
      }
      
      const kgVal = parseFloat(row[kgKey]) || 0;
      const repsVal = row[repsKey] || '';
      const repsInt = parseInt(String(repsVal).match(/\d+/)) || 0;
      
      if (repsInt > 0) {
        const set1RM = calculateOneRepMax(kgVal, repsVal);
        if (set1RM > max1RM) max1RM = set1RM;
        
        totalVolume += kgVal * repsInt;
      }
      
      setIndex++;
    }
    
    oneRmValues.push(Math.round(max1RM * 10) / 10);
    volumeValues.push(totalVolume);
  });

  // Get active neon color definitions
  const bodyStyles = getComputedStyle(document.body);
  const accentColor = bodyStyles.getPropertyValue('--accent-color').trim() || '#bd00ff';
  const glowColor = bodyStyles.getPropertyValue('--accent-glow').trim() || 'rgba(189, 0, 255, 0.4)';
  
  const ctx = canvas.getContext('2d');
  
  // Create gradient fills
  const volumeGradient = ctx.createLinearGradient(0, 0, 0, 300);
  volumeGradient.addColorStop(0, accentColor + '22'); // 13% opacity
  volumeGradient.addColorStop(1, accentColor + '00');
  
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Est. 1RM (kg)',
          data: oneRmValues,
          borderColor: accentColor,
          borderWidth: 3,
          pointBackgroundColor: accentColor,
          pointBorderColor: '#ffffff',
          pointHoverRadius: 7,
          pointRadius: 4,
          tension: 0.25,
          yAxisID: 'y-1rm',
          shadowColor: accentColor,
          shadowBlur: 10
        },
        {
          label: 'Total Volume (kg)',
          data: volumeValues,
          backgroundColor: volumeGradient,
          borderColor: accentColor + '66', // 40% opacity
          borderWidth: 1.5,
          pointBackgroundColor: accentColor + '88',
          pointRadius: 3,
          fill: true,
          tension: 0.2,
          yAxisID: 'y-vol'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#f5f6f8',
            font: {
              family: 'Outfit',
              size: 11
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(25, 27, 38, 0.95)',
          titleFont: { family: 'Outfit', size: 12, weight: 'bold' },
          bodyFont: { family: 'Outfit', size: 12 },
          borderColor: accentColor + '44',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          ticks: {
            color: '#8f94a6',
            font: { family: 'Outfit', size: 10 }
          }
        },
        'y-1rm': {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(255, 255, 255, 0.04)'
          },
          ticks: {
            color: '#f5f6f8',
            font: { family: 'Outfit', size: 10 }
          },
          title: {
            display: true,
            text: '1-Rep Max (kg)',
            color: '#f5f6f8',
            font: { family: 'Outfit', size: 11, weight: 'bold' }
          }
        },
        'y-vol': {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false // prevent overlaying grid lines
          },
          ticks: {
            color: '#8f94a6',
            font: { family: 'Outfit', size: 10 }
          },
          title: {
            display: true,
            text: 'Volume (kg)',
            color: '#8f94a6',
            font: { family: 'Outfit', size: 11, weight: 'bold' }
          }
        }
      }
    }
  });
}

// CSV Export Generator
function exportCSV() {
  if (logsData.length === 0) {
    alert('No data to export.');
    return;
  }
  
  // Find maximum set index across all logs to create dynamic columns
  let maxSets = 4; // default minimum
  logsData.forEach(row => {
    Object.keys(row).forEach(k => {
      const match = k.match(/^(\d+)\s*\(reps\)/i);
      if (match) {
        const setIdx = parseInt(match[1]);
        if (setIdx > maxSets) maxSets = setIdx;
      }
    });
  });
  
  // Build header keys
  const headers = ['Date', 'Name of Exercise'];
  for (let s = 1; s <= maxSets; s++) {
    headers.push(`${s} (kg)`);
    headers.push(`${s} (reps)`);
  }
  
  // Format rows using standard headers
  const csvRows = logsData.map(row => {
    return headers.map(header => {
      const cell = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      // Escape cell strings with quotes if they contain commas or quotes
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',');
  });
  
  // Combine headers and rows
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // UTF-8 BOM
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `flextrack_workout_logs.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
