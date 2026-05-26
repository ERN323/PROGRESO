// Global state variables
let logsData = [];
let chartInstance = null;
let currentTheme = 'purple';
let soundSettings = {
  type: 'beep',
  repeats: 2,
  volume: 0.8,
  duration: 0.35
};

// Interactive chart filter states
let activeChartTimeframe = 'all'; // '7d', '30d', 'all'
let showVolumeSeries = true;
let showOneRmSeries = true;

// Active session variables
let activeSession = {
  date: '',
  exercises: [], // { name, plannedSets, actualSets: [{weight, reps}] }
  restTime: 60,
  currentExerciseIndex: 0,
  currentSetIndex: 0,
  timerInterval: null
};

// Custom exercises & presets variables
let customExercises = [];
let customPresets = [];
let presetBuilderExercises = []; // Temp list of { name, plannedSets } in builder modal
let activeEditingPresetIndex = null; // null if creating, number if editing
let activeCatalogueCategory = 'Legs';
let activeChartMode = 'exercise'; // 'exercise' or 'muscle'
let activePresetBuilderCategory = 'Legs';
let activeAvgMuscleGroup = 'Back';
let activeAvgTimeframe = 'last';

const DEFAULT_CATALOGUE = {
  Legs: [
    'Squats',
    'Romanian Deadlifts',
    'Leg Extensions',
    'Leg Curls',
    'Calf Raises',
    'Lunges',
    'Bulgarian Split Squats'
  ],
  Chest: [
    'Barbell Bench Press',
    'Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Chest Flyes',
    'Push-ups',
    'Dips'
  ],
  Back: [
    'Barbell Rows',
    'Pull-ups',
    'Lat Pulldowns',
    'Seated Cable Rows',
    'Deadlifts',
    'Face Pulls'
  ],
  Arms: [
    'Bicep Curls',
    'Hammer Curls',
    'Tricep Pushdowns',
    'Overhead Tricep Extensions',
    'Chin-ups'
  ],
  Shoulders: [
    'Overhead Shoulder Press',
    'Lateral Raises',
    'Front Raises',
    'Rear Delt Flyes'
  ],
  Core: [
    'Planks',
    'Crunches',
    'Hanging Leg Raises',
    'Halos',
    'Russian Twists'
  ]
};

const DEFAULT_PRESETS = [
  {
    name: 'Leg Day',
    description: 'Squats, RDLs, extensions, and calf raises.',
    exercises: [
      { name: 'Squats', plannedSets: 4 },
      { name: 'Romanian Deadlifts', plannedSets: 4 },
      { name: 'Leg Extensions', plannedSets: 3 },
      { name: 'Calf Raises', plannedSets: 3 }
    ]
  },
  {
    name: 'Basic Arms',
    description: 'Bicep curls, hammer curls, tricep extensions.',
    exercises: [
      { name: 'Bicep Curls', plannedSets: 4 },
      { name: 'Tricep Pushdowns', plannedSets: 4 },
      { name: 'Hammer Curls', plannedSets: 3 },
      { name: 'Overhead Tricep Extensions', plannedSets: 3 }
    ]
  },
  {
    name: 'Chest & Shoulders',
    description: 'Bench press, overhead press, lateral raises, dips.',
    exercises: [
      { name: 'Barbell Bench Press', plannedSets: 4 },
      { name: 'Overhead Shoulder Press', plannedSets: 4 },
      { name: 'Lateral Raises', plannedSets: 3 },
      { name: 'Dips', plannedSets: 3 }
    ]
  },
  {
    name: 'Back & Core',
    description: 'Pull-ups, barbell rows, planks, halos.',
    exercises: [
      { name: 'Pull-ups', plannedSets: 4 },
      { name: 'Barbell Rows', plannedSets: 4 },
      { name: 'Planks', plannedSets: 3 },
      { name: 'Halos', plannedSets: 3 }
    ]
  },
  {
    name: 'Full Body Blast',
    description: 'Squats, dumbbell bench, rows, shoulder press.',
    exercises: [
      { name: 'Squats', plannedSets: 4 },
      { name: 'Dumbbell Bench Press', plannedSets: 4 },
      { name: 'Barbell Rows', plannedSets: 4 },
      { name: 'Shoulder Press', plannedSets: 3 }
    ]
  }
];

// State enum for workout flow screens
const AppState = {
  WELCOME: 'screen-welcome',
  PLAN_EXERCISES: 'screen-plan-exercises',
  PLAN_REST: 'screen-plan-rest',
  WAIT_REPS: 'screen-track-wait-reps',
  TIMER: 'screen-track-timer',
  SUMMARY: 'screen-summary'
};

// UI Elements (workout screens)
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
  loadCustomData();
  loadSoundSettings();
  setupEventListeners();
  updateDateDisplays();
  updateDashboard();
  updateSeriesToggleButtons();
  
  // Set default tab to workout
  switchTab('workout');
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

// Bottom Navigation Tab Selector
function switchTab(tabName) {
  // Determine direction for slide transition
  const currentActiveTabEl = document.querySelector('.nav-item.active');
  let direction = '';
  if (currentActiveTabEl) {
    const currentTab = currentActiveTabEl.dataset.tab;
    const tabOrder = ['profile', 'workout', 'analytics'];
    const currentIndex = tabOrder.indexOf(currentTab);
    const targetIndex = tabOrder.indexOf(tabName);
    if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
      direction = targetIndex > currentIndex ? 'right' : 'left';
    }
  }

  // Hide all tab panels and clear navigation item states, removing previous transition classes
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active', 'slide-from-left', 'slide-from-right');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Activate target panel & tab item
  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
    if (direction === 'left') {
      targetPanel.classList.add('slide-from-left');
    } else if (direction === 'right') {
      targetPanel.classList.add('slide-from-right');
    }
  }
  
  const targetTab = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  // Handle tab specific events
  if (tabName === 'analytics') {
    // Redraw chart with slight delay to ensure container height calculation is correct
    setTimeout(() => {
      renderMuscleBreakdown();
      drawChart();
      renderAverageWeights();
    }, 50);
  } else if (tabName === 'profile') {
    updateProfileStats();
  }
}

// Update profile metrics block
function updateProfileStats() {
  const workoutsCountEl = document.getElementById('profile-workouts-count');
  const exercisesCountEl = document.getElementById('profile-exercises-count');
  
  if (workoutsCountEl && exercisesCountEl) {
    const uniqueDates = new Set(logsData.map(r => r['Date']).filter(Boolean));
    workoutsCountEl.textContent = uniqueDates.size;
    
    let totalSets = 0;
    logsData.forEach(row => {
      let setIdx = 1;
      while (true) {
        if (row[`${setIdx} (reps)`] === undefined && setIdx > 4) break;
        if (row[`${setIdx} (reps)`]) totalSets++;
        setIdx++;
      }
    });
    exercisesCountEl.textContent = totalSets;
  }
}

// Accent Color Theme Handler
function loadTheme() {
  const savedTheme = localStorage.getItem('progreso-theme');
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
  localStorage.setItem('progreso-theme', themeName);
  
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
  const stored = localStorage.getItem('progreso-logs');
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
  localStorage.setItem('progreso-logs', JSON.stringify(logsData));
}

// Helper to clean and format dates (e.g. handling Excel numeric dates and standard separators)
function cleanImportedDate(dateStr) {
  if (!dateStr) return '';
  dateStr = String(dateStr).trim();
  
  // If it is a pure numeric Excel date serial number (e.g., 46208.03)
  if (!isNaN(dateStr) && !isNaN(parseFloat(dateStr)) && parseFloat(dateStr) > 30000 && parseFloat(dateStr) < 60000) {
    const num = parseFloat(dateStr);
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const msPerDay = 24 * 60 * 60 * 1000;
      const jsDate = new Date(excelEpoch.getTime() + num * msPerDay);
      const day = String(jsDate.getDate()).padStart(2, '0');
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const year = jsDate.getFullYear();
      return `${day}.${month}.${year}`;
    } catch (e) {
      console.error("Failed to parse numeric date:", dateStr, e);
    }
  }
  
  // Replace dashes or slashes with dots
  let cleaned = dateStr.replace(/[-/]/g, '.');
  
  // If it's DD.MM.YYYY, return it
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  
  // If it's YYYY.MM.DD
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) {
    const parts = cleaned.split('.');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  
  return cleaned;
}

// Data Normalization (standardizes sheet parsing output)
function normalizeImportedData(data) {
  return data.map(row => {
    const normalized = {};
    
    const nameKey = Object.keys(row).find(k => 
      k.toLowerCase().includes('exercise') || k.toLowerCase().includes('name')
    ) || 'Name of Exercise';
    
    const dateKey = Object.keys(row).find(k => 
      k.toLowerCase().includes('date')
    ) || 'Date';
    
    normalized['Date'] = row[dateKey] ? cleanImportedDate(row[dateKey]) : '';
    normalized['Name of Exercise'] = row[nameKey] ? String(row[nameKey]).trim() : '';
    
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
  
  const existingMap = new Map();
  logsData.forEach(row => {
    const key = `${row['Date']}||${row['Name of Exercise']}`;
    existingMap.set(key, row);
  });
  
  normalizedNew.forEach(row => {
    const key = `${row['Date']}||${row['Name of Exercise']}`;
    existingMap.set(key, row);
  });
  
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

// Helper to parse DD.MM.YYYY to Date object
function parseDateStr(str) {
  const parts = str.split('.');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(0);
}

// Layout Transition State Machine (inside workout panel)
function transitionTo(state) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  const target = screens[state];
  if (target) {
    target.classList.add('active');
    if (state === AppState.WAIT_REPS) {
      document.getElementById('set-reps-input').focus();
    }
  }
}

// Event Listeners Configuration
function setupEventListeners() {
  // Bottom Tab Navigation switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab;
      switchTab(tabName);
    });
  });

  // Timeframe selector click events
  document.querySelectorAll('.analytics-filters .timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.analytics-filters .timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartTimeframe = btn.dataset.timeframe;
      renderMuscleBreakdown();
      drawChart();
    });
  });

  // Series toggles click events
  const volBtn = document.getElementById('toggle-vol-btn');
  const oneRmBtn = document.getElementById('toggle-1rm-btn');

  if (volBtn) {
    volBtn.addEventListener('click', () => {
      showVolumeSeries = !showVolumeSeries;
      volBtn.classList.toggle('active', showVolumeSeries);
      drawChart();
    });
  }

  if (oneRmBtn) {
    oneRmBtn.addEventListener('click', () => {
      showOneRmSeries = !showOneRmSeries;
      oneRmBtn.classList.toggle('active', showOneRmSeries);
      drawChart();
    });
  }

  // Info Modal trigger listeners
  const infoBtn = document.getElementById('one-rm-info-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const infoModal = document.getElementById('info-modal');

  if (infoBtn && infoModal) {
    infoBtn.addEventListener('click', () => {
      infoModal.classList.add('active');
    });
  }

  if (closeModalBtn && infoModal) {
    closeModalBtn.addEventListener('click', () => {
      infoModal.classList.remove('active');
    });
  }

  // Close modal when clicking on the dark backdrop
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) {
        infoModal.classList.remove('active');
      }
    });
  }

  // Collapsible History Log Table
  const toggleHistoryBtn = document.getElementById('toggle-history-btn');
  const historyContainer = document.getElementById('history-collapse-container');

  if (toggleHistoryBtn && historyContainer) {
    toggleHistoryBtn.addEventListener('click', () => {
      const isOpen = historyContainer.classList.toggle('open');
      
      // Update button visual state and text
      if (isOpen) {
        toggleHistoryBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
          </svg>
          Hide History
        `;
        // Smooth scroll to history container
        setTimeout(() => {
          historyContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      } else {
        toggleHistoryBtn.innerHTML = `
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="margin-right: 8px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          History
        `;
      }
    });
  }

  // Theme changes
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => selectTheme(dot.dataset.theme));
  });

  // Spreadsheet Uploader
  const uploader = document.getElementById('spreadsheet-upload');
  if (uploader) {
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
            const overwrite = confirm("Do you want to completely replace your history with this file?\n\n- Click OK to replace history (items deleted in file will disappear)\n- Click Cancel to merge into your existing history");
            if (overwrite) {
              const normalized = normalizeImportedData(parsedData);
              logsData = normalized;
              sortLogsChronologically();
              saveLogsToStorage();
            } else {
              mergeLogs(parsedData);
            }
            updateDashboard();
            updateProfileStats();
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
  }

  // CSV Exporter & Importer
  const exportLogBtn = document.getElementById('export-log-btn');
  if (exportLogBtn) {
    exportLogBtn.addEventListener('click', exportCSV);
  }
  const importLogBtn = document.getElementById('import-log-btn');
  if (importLogBtn) {
    importLogBtn.addEventListener('click', () => {
      document.getElementById('spreadsheet-upload').click();
    });
  }

  // Presets Creator (Profile)
  const createPresetBtn = document.getElementById('create-preset-btn');
  if (createPresetBtn) {
    createPresetBtn.addEventListener('click', () => {
      openPresetBuilder();
    });
  }
  const presetCancelBtn = document.getElementById('preset-cancel-btn');
  if (presetCancelBtn) {
    presetCancelBtn.addEventListener('click', () => {
      document.getElementById('preset-builder-modal').classList.remove('active');
    });
  }
  const presetSaveBtn = document.getElementById('preset-save-btn');
  if (presetSaveBtn) {
    presetSaveBtn.addEventListener('click', savePreset);
  }
  const presetAddExBtn = document.getElementById('preset-add-ex-btn');
  if (presetAddExBtn) {
    presetAddExBtn.addEventListener('click', addPresetExercise);
  }
  const presetExSearch = document.getElementById('preset-exercise-search');
  if (presetExSearch) {
    presetExSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addPresetExercise();
      }
    });
  }

  // Catalogue Drawer Toggle
  const toggleCatalogueBtn = document.getElementById('toggle-catalogue-btn');
  if (toggleCatalogueBtn) {
    toggleCatalogueBtn.addEventListener('click', toggleCatalogueDrawer);
  }

  // Catalogue Categories Tab Pills
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCatalogueCategory = pill.dataset.category;
      renderCatalogueExerciseList();
    });
  });

  // Save Custom Exercise
  const saveCustomExBtn = document.getElementById('save-custom-ex-btn');
  if (saveCustomExBtn) {
    saveCustomExBtn.addEventListener('click', saveCustomExercise);
  }
  const newCustomExName = document.getElementById('new-custom-ex-name');
  if (newCustomExName) {
    newCustomExName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveCustomExercise();
      }
    });
  }

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
  const nativeMuscleSelect = document.getElementById('muscle-group-chart-selector');
  if (nativeMuscleSelect) {
    nativeMuscleSelect.addEventListener('change', drawChart);
  }

  // Chart Mode Toggles
  document.querySelectorAll('#chart-mode-selector .chart-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chart-mode-selector .chart-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartMode = btn.dataset.mode;
      
      updateSeriesToggleButtons();
      
      const exWrapper = document.getElementById('exercise-select-wrapper');
      const muscleWrapper = document.getElementById('muscle-group-select-wrapper');
      if (activeChartMode === 'exercise') {
        if (exWrapper) exWrapper.style.display = 'block';
        if (muscleWrapper) muscleWrapper.style.display = 'none';
      } else {
        if (exWrapper) exWrapper.style.display = 'none';
        if (muscleWrapper) muscleWrapper.style.display = 'block';
      }
      drawChart();
    });
  });

  // Custom Select Dropdown Toggle
  const selectTrigger = document.getElementById('exercise-select-trigger');
  const selectOptions = document.getElementById('exercise-select-options');
  if (selectTrigger && selectOptions) {
    selectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = selectOptions.classList.toggle('open');
      selectTrigger.classList.toggle('open', isOpen);
    });
  }

  // Muscle Group Dropdown Toggle
  const muscleTrigger = document.getElementById('muscle-group-select-trigger');
  const muscleOptions = document.getElementById('muscle-group-select-options');
  if (muscleTrigger && muscleOptions) {
    muscleTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = muscleOptions.classList.toggle('open');
      muscleTrigger.classList.toggle('open', isOpen);
    });
  }
  
  // Muscle Group Select Options
  document.querySelectorAll('#muscle-group-select-options .custom-option').forEach(opt => {
    opt.addEventListener('click', () => {
      if (nativeMuscleSelect) {
        nativeMuscleSelect.value = opt.dataset.value;
        nativeMuscleSelect.dispatchEvent(new Event('change'));
      }
      
      const textSpan = document.getElementById('muscle-group-select-text');
      if (textSpan) textSpan.textContent = opt.textContent;
      
      document.querySelectorAll('#muscle-group-select-options .custom-option').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === opt.dataset.value);
      });
      
      if (muscleOptions && muscleTrigger) {
        muscleOptions.classList.remove('open');
        muscleTrigger.classList.remove('open');
      }
    });
  });

  // Preset Builder Categories Pills in Modal
  document.querySelectorAll('.preset-catalogue-categories .cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.preset-catalogue-categories .cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activePresetBuilderCategory = pill.dataset.pcat;
      renderPresetBuilderCatalogue();
    });
  });

  // Sound settings event listeners
  const typeSelect = document.getElementById('sound-type-select');
  const repeatsSelect = document.getElementById('sound-repeats-select');
  const volSlider = document.getElementById('sound-volume-slider');
  const durSlider = document.getElementById('sound-duration-slider');
  const testSoundBtn = document.getElementById('test-sound-btn');
  
  if (typeSelect) typeSelect.addEventListener('change', saveSoundSettings);
  if (repeatsSelect) repeatsSelect.addEventListener('change', saveSoundSettings);
  if (volSlider) volSlider.addEventListener('input', saveSoundSettings);
  if (durSlider) durSlider.addEventListener('input', saveSoundSettings);
  if (testSoundBtn) testSoundBtn.addEventListener('click', () => playNotificationSound());

  // Average Weight Muscle Group Dropdown Toggle
  const avgMuscleTrigger = document.getElementById('avg-muscle-select-trigger');
  const avgMuscleOptions = document.getElementById('avg-muscle-select-options');
  if (avgMuscleTrigger && avgMuscleOptions) {
    avgMuscleTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = avgMuscleOptions.classList.toggle('open');
      avgMuscleTrigger.classList.toggle('open', isOpen);
    });
  }

  // Average Weight Muscle Select Options
  document.querySelectorAll('#avg-muscle-select-options .custom-option').forEach(opt => {
    opt.addEventListener('click', () => {
      activeAvgMuscleGroup = opt.dataset.value;
      const textSpan = document.getElementById('avg-muscle-select-text');
      if (textSpan) textSpan.textContent = opt.textContent;

      document.querySelectorAll('#avg-muscle-select-options .custom-option').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === opt.dataset.value);
      });

      if (avgMuscleOptions && avgMuscleTrigger) {
        avgMuscleOptions.classList.remove('open');
        avgMuscleTrigger.classList.remove('open');
      }

      renderAverageWeights();
    });
  });

  // Average Weight Timeframe Selector
  document.querySelectorAll('#avg-timeframe-selector .timeframe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#avg-timeframe-selector .timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAvgTimeframe = btn.dataset.avgTimeframe;
      renderAverageWeights();
    });
  });

  // Collapsible Training Distribution
  const toggleBreakdownBtn = document.getElementById('toggle-breakdown-btn');
  const breakdownContainer = document.getElementById('breakdown-collapse-container');
  const breakdownArrow = document.getElementById('breakdown-arrow');

  if (toggleBreakdownBtn && breakdownContainer) {
    toggleBreakdownBtn.addEventListener('click', () => {
      const isOpen = breakdownContainer.classList.toggle('open');
      if (isOpen) {
        breakdownContainer.style.maxHeight = '400px';
        breakdownContainer.style.opacity = '1';
        if (breakdownArrow) breakdownArrow.classList.add('rotated');
      } else {
        breakdownContainer.style.maxHeight = '0px';
        breakdownContainer.style.opacity = '0';
        if (breakdownArrow) breakdownArrow.classList.remove('rotated');
      }
    });
  }

  // Close dropdowns on click outside
  document.addEventListener('click', () => {
    if (selectTrigger && selectOptions) {
      selectOptions.classList.remove('open');
      selectTrigger.classList.remove('open');
    }
    if (muscleTrigger && muscleOptions) {
      muscleOptions.classList.remove('open');
      muscleTrigger.classList.remove('open');
    }
    if (avgMuscleTrigger && avgMuscleOptions) {
      avgMuscleOptions.classList.remove('open');
      avgMuscleTrigger.classList.remove('open');
    }
  });

  // Swipe navigation detection
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const tabOrder = ['profile', 'workout', 'analytics'];

  document.addEventListener('touchstart', (e) => {
    // Disable swipe navigation if modal or catalogue drawer is open
    const catalogueDrawer = document.getElementById('catalogue-drawer');
    const hasActiveModal = document.querySelector('.modal-overlay.active');
    if (hasActiveModal || (catalogueDrawer && catalogueDrawer.classList.contains('open'))) {
      return;
    }

    const target = e.target;
    if (target.closest('input[type="range"]') || 
        target.closest('canvas') || 
        target.closest('.custom-select-wrapper') || 
        target.closest('.custom-options') ||
        target.closest('.chart-container') ||
        target.closest('#planned-list') ||
        target.closest('.logs-table-container') ||
        target.closest('.table-wrapper')) {
      return;
    }
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    // Disable swipe navigation if modal or catalogue drawer is open
    const catalogueDrawer = document.getElementById('catalogue-drawer');
    const hasActiveModal = document.querySelector('.modal-overlay.active');
    if (hasActiveModal || (catalogueDrawer && catalogueDrawer.classList.contains('open'))) {
      return;
    }

    const target = e.target;
    if (target.closest('input[type="range"]') || 
        target.closest('canvas') || 
        target.closest('.custom-select-wrapper') || 
        target.closest('.custom-options') ||
        target.closest('.chart-container') ||
        target.closest('#planned-list') ||
        target.closest('.logs-table-container') ||
        target.closest('.table-wrapper')) {
      return;
    }
    
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    handleSwipeGesture();
  }, { passive: true });

  function handleSwipeGesture() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 75) {
      const currentTabEl = document.querySelector('.nav-item.active');
      if (!currentTabEl) return;
      const currentTab = currentTabEl.dataset.tab;
      const currentIndex = tabOrder.indexOf(currentTab);
      if (currentIndex === -1) return;
      
      if (diffX < 0) {
        // Swipe left (next tab)
        if (currentIndex < tabOrder.length - 1) {
          switchTab(tabOrder[currentIndex + 1]);
        }
      } else {
        // Swipe right (previous tab)
        if (currentIndex > 0) {
          switchTab(tabOrder[currentIndex - 1]);
        }
      }
    }
  }
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

// Looks up the last weight logged for a particular exercise
function findLastUsedWeight(exerciseName) {
  const lowerExName = exerciseName.toLowerCase();
  for (let i = logsData.length - 1; i >= 0; i--) {
    const row = logsData[i];
    if (row['Name of Exercise'] && row['Name of Exercise'].toLowerCase() === lowerExName) {
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
  
  const isLastSet = activeSession.currentSetIndex === currentEx.plannedSets - 1;
  const isLastExercise = activeSession.currentExerciseIndex === activeSession.exercises.length - 1;
  
  if (isLastSet && isLastExercise) {
    saveCompletedSession();
  } else {
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

// Skip timer button
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

// Programmatic Web Audio Synthesizer Beep (wrapper for custom rest sounds)
function playBeep() {
  playNotificationSound();
}

// Summary Screen Implementation
function saveCompletedSession() {
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
  
  mergeLogs(newRows);
  
  document.getElementById('summary-exercises-count').textContent = activeSession.exercises.length;
  let totalSets = 0;
  activeSession.exercises.forEach(ex => totalSets += ex.actualSets.length);
  document.getElementById('summary-sets-count').textContent = totalSets;
  
  updateDashboard();
  updateProfileStats();
  
  transitionTo(AppState.SUMMARY);
}

// Dashboard & Visualizations (Chart.js)
function updateDashboard() {
  populateExerciseSelect();
  renderLogsTable();
  populateExerciseAutocomplete();
  renderPresets();
  renderCatalogue();
  renderMuscleBreakdown();
  drawChart();
  renderAverageWeights();
}

function populateExerciseSelect() {
  const select = document.getElementById('exercise-chart-selector');
  const currentValue = select.value;
  
  const exercises = [...new Set(logsData.map(r => r['Name of Exercise']))].filter(Boolean);
  exercises.sort();
  
  select.innerHTML = '<option value="">Select Exercise</option>';
  exercises.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex;
    opt.textContent = ex;
    select.appendChild(opt);
  });
  
  if (exercises.includes(currentValue)) {
    select.value = currentValue;
  } else if (exercises.length > 0) {
    select.value = exercises[0];
  }

  // Populate and render custom select
  renderCustomSelect();
}

function renderCustomSelect() {
  const trigger = document.getElementById('exercise-select-trigger');
  const optionsContainer = document.getElementById('exercise-select-options');
  const customText = document.getElementById('custom-select-text');
  const nativeSelect = document.getElementById('exercise-chart-selector');
  
  if (!trigger || !optionsContainer || !customText || !nativeSelect) return;
  
  // Set initial text
  const currentVal = nativeSelect.value;
  const matchedOpt = nativeSelect.querySelector(`option[value="${currentVal}"]`);
  customText.textContent = matchedOpt ? matchedOpt.textContent : 'Select Exercise';
  
  // Clear custom options
  optionsContainer.innerHTML = '';
  
  const nativeOptions = nativeSelect.querySelectorAll('option');
  nativeOptions.forEach(opt => {
    if (opt.value === '') return; // Skip placeholder option
    
    const div = document.createElement('div');
    div.className = 'custom-option';
    if (opt.value === currentVal) {
      div.classList.add('selected');
    }
    div.textContent = opt.textContent;
    div.dataset.value = opt.value;
    
    div.addEventListener('click', () => {
      // Update native select
      nativeSelect.value = opt.value;
      nativeSelect.dispatchEvent(new Event('change'));
      
      // Update label and styles
      customText.textContent = opt.textContent;
      document.querySelectorAll('.custom-option').forEach(item => {
        item.classList.toggle('selected', item.dataset.value === opt.value);
      });
      
      // Close dropdown
      optionsContainer.classList.remove('open');
      trigger.classList.remove('open');
    });
    
    optionsContainer.appendChild(div);
  });
}

function populateExerciseAutocomplete() {
  const datalist = document.getElementById('ex-autocomplete');
  if (!datalist) return;
  const logExercises = logsData.map(r => r['Name of Exercise']);
  const catExercises = Object.values(DEFAULT_CATALOGUE).flat();
  const allEx = [...new Set([...logExercises, ...catExercises, ...customExercises])].filter(Boolean);
  allEx.sort();
  
  datalist.innerHTML = '';
  allEx.forEach(ex => {
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
          No workout logs loaded.
        </td>
      </tr>
    `;
    return;
  }
  
  const displayLogs = [...logsData].reverse();
  
  displayLogs.forEach(row => {
    const tr = document.createElement('tr');
    
    const dateTd = document.createElement('td');
    dateTd.textContent = row['Date'] || '';
    tr.appendChild(dateTd);
    
    const exTd = document.createElement('td');
    exTd.textContent = row['Name of Exercise'] || '';
    exTd.style.fontWeight = '600';
    tr.appendChild(exTd);
    
    for (let s = 1; s <= 4; s++) {
      const td = document.createElement('td');
      const kg = row[`${s} (kg)`];
      const reps = row[`${s} (reps)`];
      
      if (kg !== undefined && kg !== '' && reps !== undefined && reps !== '') {
        td.innerHTML = `<span style="color:var(--text-primary); font-weight:600;">${kg}</span> <span style="color:var(--text-secondary); font-size:0.75rem;">kg</span> × <span style="color:var(--accent-color); font-weight:600;">${reps}</span>`;
      } else if (reps !== undefined && reps !== '') {
        td.innerHTML = `<span style="color:var(--accent-color); font-weight:600;">${reps}</span> <span style="color:var(--text-secondary); font-size:0.75rem;">reps</span>`;
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
  const reps = parseInt(String(repsStr).match(/\d+/)) || 0;
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Chart rendering function with toggles and range filtering
function drawChart() {
  const placeholder = document.getElementById('chart-placeholder-msg');
  const canvas = document.getElementById('progressChart');
  
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  
  if (logsData.length === 0) {
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.innerHTML = '<p>No data records found. Log some workouts first!</p>';
    }
    if (canvas) canvas.style.display = 'none';
    return;
  }
  
  if (activeChartMode === 'exercise') {
    const selectedEx = document.getElementById('exercise-chart-selector').value;
    if (!selectedEx || (!showVolumeSeries && !showOneRmSeries)) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = !selectedEx 
          ? '<p>Select an exercise to view charts.</p>' 
          : '<p>Toggle at least one data series (Volume or 1RM) to view the graph.</p>';
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    if (placeholder) placeholder.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    
    // Filter logs for selected exercise
    const exerciseLogs = logsData.filter(r => 
      r['Name of Exercise'] && r['Name of Exercise'].toLowerCase() === selectedEx.toLowerCase()
    );
    
    if (exerciseLogs.length === 0) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<p>No data records found for this exercise.</p>';
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    // Find latest entry date in exerciseLogs to filter relatively
    let latestDate = new Date(0);
    exerciseLogs.forEach(row => {
      const d = parseDateStr(row['Date']);
      if (d > latestDate) latestDate = d;
    });
    
    // Apply Timeframe date range filter
    let filteredLogs = exerciseLogs;
    if (activeChartTimeframe !== 'all') {
      const cutoffDays = activeChartTimeframe === '7d' ? 7 : 30;
      const cutoffTime = latestDate.getTime() - (cutoffDays * 24 * 60 * 60 * 1000);
      
      filteredLogs = exerciseLogs.filter(row => {
        const entryTime = parseDateStr(row['Date']).getTime();
        return entryTime >= cutoffTime;
      });
    }

    if (filteredLogs.length === 0) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<p>No data found within the selected ${activeChartTimeframe === '7d' ? '7 days' : '30 days'}.</p>`;
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    // Parse labels and series values
    const labels = [];
    const oneRmValues = [];
    const volumeValues = [];
    
    filteredLogs.forEach(row => {
      labels.push(row['Date']);
      
      let max1RM = 0;
      let totalVolume = 0;
      
      let setIndex = 1;
      while (true) {
        const kgKey = `${setIndex} (kg)`;
        const repsKey = `${setIndex} (reps)`;
        
        if (row[kgKey] === undefined && row[repsKey] === undefined && setIndex > 4) break;
        
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

    const bodyStyles = getComputedStyle(document.body);
    const accentColor = bodyStyles.getPropertyValue('--accent-color').trim() || '#bd00ff';
    
    const ctx = canvas.getContext('2d');
    const datasets = [];
    
    if (showOneRmSeries) {
      datasets.push({
        label: 'Est. 1RM (kg)',
        data: oneRmValues,
        borderColor: accentColor,
        borderWidth: 3,
        pointBackgroundColor: accentColor,
        pointBorderColor: '#ffffff',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.25,
        yAxisID: 'y-vol'
      });
    }
    
    if (showVolumeSeries) {
      const volumeGradient = ctx.createLinearGradient(0, 0, 0, 250);
      volumeGradient.addColorStop(0, accentColor + '20');
      volumeGradient.addColorStop(1, accentColor + '00');
      
      datasets.push({
        label: 'Total Volume (kg)',
        data: volumeValues,
        backgroundColor: volumeGradient,
        borderColor: accentColor + '50',
        borderWidth: 1.5,
        pointBackgroundColor: accentColor + '70',
        pointRadius: 2.5,
        fill: true,
        tension: 0.2,
        yAxisID: 'y-vol2'
      });
    }
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        layout: {
          padding: {
            bottom: 12
          }
        },
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
              font: { family: 'Outfit', size: 10 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(25, 27, 38, 0.95)',
            titleFont: { family: 'Outfit', size: 11, weight: 'bold' },
            bodyFont: { family: 'Outfit', size: 11 },
            borderColor: accentColor + '30',
            borderWidth: 1,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#8f94a6', font: { family: 'Outfit', size: 9 } }
          },
          'y-vol': {
            type: 'linear',
            display: showOneRmSeries,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#f5f6f8', font: { family: 'Outfit', size: 9 } },
            title: {
              display: true,
              text: '1RM (kg)',
              color: '#f5f6f8',
              font: { family: 'Outfit', size: 10, weight: 'bold' }
            }
          },
          'y-vol2': {
            type: 'linear',
            display: showVolumeSeries,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#8f94a6', font: { family: 'Outfit', size: 9 } },
            title: {
              display: true,
              text: 'Volume (kg)',
              color: '#8f94a6',
              font: { family: 'Outfit', size: 10, weight: 'bold' }
            }
          }
        }
      }
    });

  } else {
    // Muscle group aggregate progress charts
    const selectedMuscle = document.getElementById('muscle-group-chart-selector').value;
    if (placeholder) placeholder.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    
    // Group records by Date
    const dateMap = new Map();
    
    logsData.forEach(row => {
      if (!row['Name of Exercise'] || !row['Date']) return;
      const cat = getExerciseCategory(row['Name of Exercise']);
      if (cat.toLowerCase() !== selectedMuscle.toLowerCase()) return;
      
      const date = row['Date'];
      if (!dateMap.has(date)) {
        dateMap.set(date, { totalVolume: 0 });
      }
      
      const dateData = dateMap.get(date);
      let setIndex = 1;
      while (true) {
        const kgKey = `${setIndex} (kg)`;
        const repsKey = `${setIndex} (reps)`;
        if (row[kgKey] === undefined && row[repsKey] === undefined && setIndex > 4) break;
        
        const kgVal = parseFloat(row[kgKey]) || 0;
        const repsVal = row[repsKey] || '';
        const repsInt = parseInt(String(repsVal).match(/\d+/)) || 0;
        
        if (repsInt > 0) {
          dateData.totalVolume += kgVal * repsInt;
        }
        setIndex++;
      }
    });
    
    const dataPoints = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      volume: data.totalVolume
    }));
    
    if (dataPoints.length === 0) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<p>No training records found for the ${selectedMuscle} group.</p>`;
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    // Sort chronologically and compute running cumulative sum
    dataPoints.sort((a, b) => parseDateStr(a.date) - parseDateStr(b.date));
    let runningVolume = 0;
    dataPoints.forEach(pt => {
      runningVolume += pt.volume;
      pt.cumulativeVolume = runningVolume;
    });
    
    let latestDate = new Date(0);
    dataPoints.forEach(pt => {
      const d = parseDateStr(pt.date);
      if (d > latestDate) latestDate = d;
    });
    
    let filteredPoints = dataPoints;
    if (activeChartTimeframe !== 'all') {
      const cutoffDays = activeChartTimeframe === '7d' ? 7 : 30;
      const cutoffTime = latestDate.getTime() - (cutoffDays * 24 * 60 * 60 * 1000);
      
      filteredPoints = dataPoints.filter(pt => {
        return parseDateStr(pt.date).getTime() >= cutoffTime;
      });
    }
    
    if (filteredPoints.length === 0) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = `<p>No data found within the selected ${activeChartTimeframe === '7d' ? '7 days' : '30 days'}.</p>`;
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    if (!showVolumeSeries && !showOneRmSeries) {
      if (placeholder) {
        placeholder.style.display = 'block';
        placeholder.innerHTML = '<p>Toggle at least one data series (Daily or Cumulative Volume) to view the graph.</p>';
      }
      if (canvas) canvas.style.display = 'none';
      return;
    }
    
    const labels = filteredPoints.map(pt => pt.date);
    const volumeValues = filteredPoints.map(pt => pt.volume);
    const cumulativeValues = filteredPoints.map(pt => pt.cumulativeVolume);
    
    const bodyStyles = getComputedStyle(document.body);
    const accentColor = bodyStyles.getPropertyValue('--accent-color').trim() || '#bd00ff';
    const ctx = canvas.getContext('2d');
    const datasets = [];
    
    // Daily Volume dataset (Left axis)
    if (showVolumeSeries) {
      const dailyGradient = ctx.createLinearGradient(0, 0, 0, 250);
      dailyGradient.addColorStop(0, accentColor + '20');
      dailyGradient.addColorStop(1, accentColor + '00');
      
      datasets.push({
        label: 'Daily Volume (kg)',
        data: volumeValues,
        backgroundColor: dailyGradient,
        borderColor: accentColor,
        borderWidth: 3,
        pointBackgroundColor: accentColor,
        pointBorderColor: '#ffffff',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.25,
        fill: true,
        yAxisID: 'y-daily'
      });
    }
    
    // Cumulative Volume dataset (Right axis)
    if (showOneRmSeries) {
      datasets.push({
        label: 'Cumulative Volume (kg)',
        data: cumulativeValues,
        borderColor: '#ffffff',
        borderWidth: 2.5,
        pointBackgroundColor: '#ffffff',
        pointRadius: 3,
        tension: 0.2,
        yAxisID: 'y-cumulative'
      });
    }
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        layout: {
          padding: {
            bottom: 12
          }
        },
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
              font: { family: 'Outfit', size: 10 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(25, 27, 38, 0.95)',
            titleFont: { family: 'Outfit', size: 11, weight: 'bold' },
            bodyFont: { family: 'Outfit', size: 11 },
            borderColor: accentColor + '30',
            borderWidth: 1,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#8f94a6', font: { family: 'Outfit', size: 9 } }
          },
          'y-daily': {
            type: 'linear',
            display: showVolumeSeries,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#f5f6f8', font: { family: 'Outfit', size: 9 } },
            title: {
              display: true,
              text: 'Daily Volume (kg)',
              color: '#f5f6f8',
              font: { family: 'Outfit', size: 10, weight: 'bold' }
            }
          },
          'y-cumulative': {
            type: 'linear',
            display: showOneRmSeries,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#8f94a6', font: { family: 'Outfit', size: 9 } },
            title: {
              display: true,
              text: 'Cumulative Volume (kg)',
              color: '#8f94a6',
              font: { family: 'Outfit', size: 10, weight: 'bold' }
            }
          }
        }
      }
    });
  }
}

// CSV Export Generator
function exportCSV() {
  if (logsData.length === 0) {
    alert('No data to export.');
    return;
  }
  
  let maxSets = 4;
  logsData.forEach(row => {
    Object.keys(row).forEach(k => {
      const match = k.match(/^(\d+)\s*\(reps\)/i);
      if (match) {
        const setIdx = parseInt(match[1]);
        if (setIdx > maxSets) maxSets = setIdx;
      }
    });
  });
  
  const headers = ['Date', 'Name of Exercise'];
  for (let s = 1; s <= maxSets; s++) {
    headers.push(`${s} (kg)`);
    headers.push(`${s} (reps)`);
  }
  
  const csvRows = logsData.map(row => {
    return headers.map(header => {
      let cell = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
      if (header === 'Date' && cell) {
        cell = cell.replace(/\./g, '-');
      }
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',');
  });
  
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `progreso_workout_logs.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Load Custom Exercises and Presets from localStorage
function loadCustomData() {
  const storedEx = localStorage.getItem('progreso-custom-exercises');
  if (storedEx) {
    try {
      const parsed = JSON.parse(storedEx);
      // Migrate strings to objects for backward compatibility
      customExercises = parsed.map(item => {
        if (typeof item === 'string') {
          return { name: item, category: 'Core' }; // Default fallback category
        }
        return item;
      });
    } catch (e) {
      console.error('Error loading custom exercises:', e);
      customExercises = [];
    }
  }
  
  const storedPresets = localStorage.getItem('progreso-custom-presets');
  if (storedPresets) {
    try {
      customPresets = JSON.parse(storedPresets);
    } catch (e) {
      console.error('Error loading custom presets:', e);
      customPresets = [];
    }
  }
}

// Get the category of an exercise (checking defaults, custom list, and keyword mapping)
function getExerciseCategory(exerciseName) {
  if (!exerciseName) return 'Core';
  const nameLower = exerciseName.toLowerCase().trim();
  
  // 1. Check standard default catalogue
  for (const [category, list] of Object.entries(DEFAULT_CATALOGUE)) {
    if (list.some(ex => ex.toLowerCase() === nameLower)) {
      return category;
    }
  }
  
  // 2. Check custom exercises
  const matchedCustom = customExercises.find(ex => ex.name.toLowerCase() === nameLower);
  if (matchedCustom) {
    return matchedCustom.category;
  }
  
  // 3. Fallback keyword matching for logs/imported names
  if (nameLower.includes('squat') || nameLower.includes('leg') || nameLower.includes('calf') || nameLower.includes('lunge') || nameLower.includes('quad') || nameLower.includes('hamstring') || nameLower.includes('glute')) {
    return 'Legs';
  }
  if (nameLower.includes('bench') || nameLower.includes('flye') || nameLower.includes('chest') || nameLower.includes('pushup') || nameLower.includes('push-up') || nameLower.includes('dip')) {
    return 'Chest';
  }
  if (nameLower.includes('row') || nameLower.includes('pull') || nameLower.includes('lat') || nameLower.includes('chin') || nameLower.includes('deadlift')) {
    return 'Back';
  }
  if (nameLower.includes('curl') || nameLower.includes('tricep') || nameLower.includes('bicep') || nameLower.includes('arm') || nameLower.includes('pushdown') || nameLower.includes('extension')) {
    return 'Arms';
  }
  if (nameLower.includes('shoulder') || nameLower.includes('press') || nameLower.includes('raise') || nameLower.includes('delt')) {
    return 'Shoulders';
  }
  if (nameLower.includes('plank') || nameLower.includes('crunch') || nameLower.includes('ab') || nameLower.includes('halo') || nameLower.includes('twist') || nameLower.includes('core')) {
    return 'Core';
  }
  
  return 'Core'; // default fallback
}

// Save Custom Exercises to localStorage
function saveCustomExercises() {
  localStorage.setItem('progreso-custom-exercises', JSON.stringify(customExercises));
}

// Save Custom Presets to localStorage
function saveCustomPresets() {
  localStorage.setItem('progreso-custom-presets', JSON.stringify(customPresets));
}

// Render presets lists in Profile and Workout welcome screens
function renderPresets() {
  renderPresetsInProfile();
  renderPresetsOnWelcome();
}

// Renders the list of custom presets in the Profile section
function renderPresetsInProfile() {
  const container = document.getElementById('presets-management-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (customPresets.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.9rem; padding: 20px 0;">No custom presets created yet.</p>';
    return;
  }
  
  customPresets.forEach((preset, index) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    
    const exCount = preset.exercises.length;
    const exNames = preset.exercises.map(e => e.name).join(', ');
    const descText = exNames.length > 36 ? exNames.substring(0, 36) + '...' : exNames;
    
    item.innerHTML = `
      <div class="preset-info">
        <h4>${preset.name}</h4>
        <p style="margin: 0; line-height: 1.2;">${exCount} exercise${exCount === 1 ? '' : 's'} • ${descText}</p>
      </div>
      <div class="preset-actions">
        <button class="btn btn-secondary btn-icon" onclick="openPresetBuilder(${index})" style="width: 32px; height: 32px; border-radius: 8px; padding: 0;" title="Edit Preset">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button class="btn btn-danger btn-icon" onclick="deletePreset(${index})" style="width: 32px; height: 32px; border-radius: 8px; padding: 0;" title="Delete Preset">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Renders presets on the welcome screen
function renderPresetsOnWelcome() {
  const customContainer = document.getElementById('welcome-custom-presets-list');
  const defaultContainer = document.getElementById('welcome-default-presets-list');
  
  if (customContainer) {
    customContainer.innerHTML = '';
    if (customPresets.length === 0) {
      customContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic; padding: 4px 0;">No custom presets. Create one in the Profile tab!</p>';
    } else {
      customPresets.forEach((preset, index) => {
        const card = document.createElement('div');
        card.className = 'preset-welcome-card';
        const exCount = preset.exercises.length;
        
        card.innerHTML = `
          <div>
            <div class="p-name">${preset.name}</div>
            <div class="p-desc">${exCount} exercise${exCount === 1 ? '' : 's'} planned</div>
          </div>
          <div class="p-arrow">→</div>
        `;
        
        card.addEventListener('click', () => {
          loadPresetIntoSession(preset);
        });
        
        customContainer.appendChild(card);
      });
    }
  }
  
  if (defaultContainer) {
    defaultContainer.innerHTML = '';
    DEFAULT_PRESETS.forEach((preset, index) => {
      const card = document.createElement('div');
      card.className = 'preset-welcome-card';
      
      card.innerHTML = `
        <div>
          <div class="p-name">${preset.name}</div>
          <div class="p-desc">${preset.description}</div>
        </div>
        <div class="p-arrow">→</div>
      `;
      
      card.addEventListener('click', () => {
        loadPresetIntoSession(preset);
      });
      
      defaultContainer.appendChild(card);
    });
  }
}

// Load a preset's exercises into the active session planner
function loadPresetIntoSession(preset) {
  activeSession.date = getTodayDateString();
  
  // Clone exercises from preset
  activeSession.exercises = preset.exercises.map(ex => ({
    name: ex.name,
    plannedSets: ex.plannedSets,
    actualSets: []
  }));
  
  renderPlannedExercisesList();
  transitionTo(AppState.PLAN_EXERCISES);
}

// Opens the preset builder modal
window.openPresetBuilder = function(presetIndex = null) {
  const modal = document.getElementById('preset-builder-modal');
  const titleEl = document.getElementById('preset-modal-title');
  const nameInput = document.getElementById('preset-name-input');
  
  if (!modal || !titleEl || !nameInput) return;
  
  activeEditingPresetIndex = presetIndex;
  
  // Clear inputs
  document.getElementById('preset-exercise-search').value = '';
  document.getElementById('preset-builder-sets-input').value = '4';
  
  if (presetIndex === null) {
    titleEl.textContent = 'Create Workout Preset';
    nameInput.value = '';
    presetBuilderExercises = [];
  } else {
    const preset = customPresets[presetIndex];
    titleEl.textContent = 'Edit Workout Preset';
    nameInput.value = preset.name;
    // Deep clone exercises
    presetBuilderExercises = preset.exercises.map(e => ({ ...e }));
  }
  
  // Reset categories inside preset modal catalogue
  document.querySelectorAll('.preset-catalogue-categories .cat-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.pcat === 'Legs');
  });
  activePresetBuilderCategory = 'Legs';
  renderPresetBuilderCatalogue();
  
  renderPresetBuilderExercises();
  modal.classList.add('active');
}

// Renders the list of exercises inside the preset builder modal
function renderPresetBuilderExercises() {
  const listContainer = document.getElementById('preset-builder-exercises-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (presetBuilderExercises.length === 0) {
    listContainer.innerHTML = '<p id="preset-builder-empty-msg" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 30px 10px;">No exercises added to this routine yet.</p>';
    return;
  }
  
  presetBuilderExercises.forEach((ex, idx) => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.background = 'rgba(255,255,255,0.03)';
    item.style.border = '1px solid rgba(255,255,255,0.06)';
    item.style.borderRadius = '8px';
    item.style.padding = '6px 12px';
    item.style.fontSize = '0.85rem';
    
    item.innerHTML = `
      <div>
        <span style="font-weight:600; color:var(--text-primary);">${ex.name}</span>
        <span style="color:var(--text-secondary); font-size:0.78rem; margin-left:6px;">(${ex.plannedSets} sets)</span>
      </div>
      <button class="btn btn-danger btn-icon" onclick="removePresetBuilderExercise(${idx})" style="width: 24px; height: 24px; border-radius: 6px; padding:0;">
        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    `;
    listContainer.appendChild(item);
  });
}

// Add exercise to preset builder list
function addPresetExercise() {
  const searchInput = document.getElementById('preset-exercise-search');
  const setsInput = document.getElementById('preset-builder-sets-input');
  
  const name = searchInput.value.trim();
  const sets = parseInt(setsInput.value) || 4;
  
  if (!name) return;
  
  presetBuilderExercises.push({ name, plannedSets: sets });
  searchInput.value = '';
  setsInput.value = '4';
  
  renderPresetBuilderExercises();
  searchInput.focus();
}

// Remove exercise from preset builder list
window.removePresetBuilderExercise = function(index) {
  presetBuilderExercises.splice(index, 1);
  renderPresetBuilderExercises();
};

// Saves the preset to storage
function savePreset() {
  const nameInput = document.getElementById('preset-name-input');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('Please enter a name for the preset.');
    nameInput.focus();
    return;
  }
  
  if (presetBuilderExercises.length === 0) {
    alert('Please add at least one exercise to the routine.');
    return;
  }
  
  const presetData = {
    name: name,
    exercises: presetBuilderExercises.map(e => ({ name: e.name, plannedSets: e.plannedSets }))
  };
  
  if (activeEditingPresetIndex === null) {
    customPresets.push(presetData);
  } else {
    customPresets[activeEditingPresetIndex] = presetData;
  }
  
  saveCustomPresets();
  renderPresets();
  
  // Close modal
  document.getElementById('preset-builder-modal').classList.remove('active');
}

// Deletes a custom preset
window.deletePreset = function(index) {
  if (confirm(`Are you sure you want to delete the preset "${customPresets[index].name}"?`)) {
    customPresets.splice(index, 1);
    saveCustomPresets();
    renderPresets();
  }
};

// Toggle the Catalogue Drawer
function toggleCatalogueDrawer() {
  const drawer = document.getElementById('catalogue-drawer');
  const btn = document.getElementById('toggle-catalogue-btn');
  if (!drawer || !btn) return;
  
  const isOpen = drawer.classList.toggle('open');
  if (isOpen) {
    btn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="margin-right: 6px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
      </svg>
      Hide Catalogue
    `;
    renderCatalogue();
  } else {
    btn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="margin-right: 6px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
      Browse Catalogue
    `;
  }
}

// Render the catalogue elements
function renderCatalogue() {
  renderCatalogueExerciseList();
}

// Render exercises list of active catalogue category
function renderCatalogueExerciseList() {
  const listContainer = document.getElementById('catalogue-exercise-list');
  const customForm = document.getElementById('custom-exercise-builder');
  
  if (!listContainer || !customForm) return;
  
  listContainer.innerHTML = '';
  
  if (activeCatalogueCategory === 'Custom') {
    customForm.style.display = 'block';
    
    if (customExercises.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:0.82rem; padding: 20px 0;">No custom exercises created yet. Create one below!</p>';
      return;
    }
    
    customExercises.forEach((ex, idx) => {
      const item = document.createElement('div');
      item.className = 'catalogue-item';
      item.innerHTML = `
        <span>${ex.name} <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:6px;">(${ex.category})</span></span>
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="add-ex-btn" title="Add to Routine" onclick="addCatalogueExercise('${ex.name.replace(/'/g, "\\'")}')">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button class="btn btn-danger btn-icon" onclick="deleteCustomExercise(${idx})" style="width:20px; height:20px; border-radius:4px; padding:0; justify-content:center; display:flex; align-items:center;" title="Delete Exercise">
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      `;
      listContainer.appendChild(item);
    });
  } else {
    customForm.style.display = 'none';
    
    const exercises = DEFAULT_CATALOGUE[activeCatalogueCategory] || [];
    exercises.forEach(ex => {
      const item = document.createElement('div');
      item.className = 'catalogue-item';
      item.innerHTML = `
        <span>${ex}</span>
        <button class="add-ex-btn" title="Add to Routine" onclick="addCatalogueExercise('${ex.replace(/'/g, "\\'")}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
        </button>
      `;
      listContainer.appendChild(item);
    });
  }
}

// Add exercise from catalogue list directly to planned exercises
window.addCatalogueExercise = function(name) {
  const setsInput = document.getElementById('plan-ex-sets');
  const sets = parseInt(setsInput.value) || 4;
  
  activeSession.exercises.push({
    name: name,
    plannedSets: sets,
    actualSets: []
  });
  
  renderPlannedExercisesList();
};

// Deletes a custom exercise
window.deleteCustomExercise = function(idx) {
  const name = customExercises[idx].name;
  if (confirm(`Are you sure you want to delete the custom exercise "${name}"?`)) {
    customExercises.splice(idx, 1);
    saveCustomExercises();
    renderCatalogueExerciseList();
    populateExerciseAutocomplete();
  }
};

// Saves a new custom exercise
function saveCustomExercise() {
  const input = document.getElementById('new-custom-ex-name');
  const catSelect = document.getElementById('custom-ex-cat-select');
  const name = input.value.trim();
  const category = catSelect ? catSelect.value : 'Core';
  
  if (!name) return;
  
  // Duplicate check
  const customExNames = customExercises.map(e => e.name);
  const allEx = [...Object.values(DEFAULT_CATALOGUE).flat(), ...customExNames].map(s => s.toLowerCase());
  if (allEx.includes(name.toLowerCase())) {
    alert('An exercise with this name already exists in the catalogue!');
    input.focus();
    return;
  }
  
  customExercises.push({ name: name, category: category });
  customExercises.sort((a, b) => a.name.localeCompare(b.name));
  saveCustomExercises();
  
  input.value = '';
  renderCatalogueExerciseList();
  populateExerciseAutocomplete();
}

// Render the exercises catalogue list inside the preset builder modal
function renderPresetBuilderCatalogue() {
  const container = document.getElementById('preset-catalogue-exercise-list');
  if (!container) return;
  container.innerHTML = '';
  
  let exercises = [];
  if (activePresetBuilderCategory === 'Custom') {
    exercises = customExercises.map(ex => ex.name);
  } else {
    exercises = DEFAULT_CATALOGUE[activePresetBuilderCategory] || [];
  }
  
  if (exercises.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:0.8rem; padding: 10px 0; margin:0;">No exercises found.</p>';
    return;
  }
  
  exercises.forEach(name => {
    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '4px 6px';
    item.style.borderRadius = '4px';
    item.style.fontSize = '0.8rem';
    item.style.background = 'rgba(255, 255, 255, 0.02)';
    item.style.border = '1px solid rgba(255, 255, 255, 0.04)';
    item.style.marginBottom = '4px';
    
    item.innerHTML = `
      <span style="color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${name}</span>
      <button class="add-ex-btn" title="Add to Preset" onclick="addExerciseToPresetBuilderList('${name.replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; width:20px; height:20px;">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
      </button>
    `;
    container.appendChild(item);
  });
}

// Add exercise from preset catalogue to temporary preset builder list
window.addExerciseToPresetBuilderList = function(name) {
  const setsInput = document.getElementById('preset-builder-sets-input');
  const sets = parseInt(setsInput.value) || 4;
  
  presetBuilderExercises.push({ name, plannedSets: sets });
  renderPresetBuilderExercises();
};

// Render muscle training split progress bars
function renderMuscleBreakdown() {
  const container = document.getElementById('muscle-bars-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Calculate date range filter (same as drawChart)
  let latestDate = new Date(0);
  logsData.forEach(row => {
    if (!row['Date']) return;
    const d = parseDateStr(row['Date']);
    if (d > latestDate) latestDate = d;
  });
  
  let filteredLogs = logsData;
  if (activeChartTimeframe !== 'all' && logsData.length > 0) {
    const cutoffDays = activeChartTimeframe === '7d' ? 7 : 30;
    const cutoffTime = latestDate.getTime() - (cutoffDays * 24 * 60 * 60 * 1000);
    
    filteredLogs = logsData.filter(row => {
      if (!row['Date']) return false;
      const entryTime = parseDateStr(row['Date']).getTime();
      return entryTime >= cutoffTime;
    });
  }
  
  const categorySets = {
    Chest: 0,
    Back: 0,
    Legs: 0,
    Arms: 0,
    Shoulders: 0,
    Core: 0
  };
  let totalSets = 0;
  
  filteredLogs.forEach(row => {
    if (!row['Name of Exercise']) return;
    const cat = getExerciseCategory(row['Name of Exercise']);
    
    let setIndex = 1;
    while (true) {
      const repsKey = `${setIndex} (reps)`;
      if (row[repsKey] === undefined && setIndex > 4) break;
      
      const repsVal = row[repsKey] || '';
      const repsInt = parseInt(String(repsVal).match(/\d+/)) || 0;
      
      if (repsInt > 0) {
        if (categorySets[cat] !== undefined) {
          categorySets[cat]++;
        } else {
          categorySets['Core']++;
        }
        totalSets++;
      }
      setIndex++;
    }
  });
  
  // Sort categories by number of sets descending
  const sortedCategories = Object.keys(categorySets).sort((a, b) => categorySets[b] - categorySets[a]);
  
  sortedCategories.forEach(cat => {
    const sets = categorySets[cat];
    const percentage = totalSets > 0 ? Math.round((sets / totalSets) * 100) : 0;
    
    const row = document.createElement('div');
    row.className = 'muscle-bar-row';
    row.innerHTML = `
      <div class="muscle-bar-header">
        <span class="muscle-bar-name">${cat}</span>
        <span class="muscle-bar-stats"><span class="highlight-val">${sets}</span> set${sets === 1 ? '' : 's'} (${percentage}%)</span>
      </div>
      <div class="muscle-bar-track">
        <div class="muscle-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

// Update the series filter button text dynamically based on the active chart mode
function updateSeriesToggleButtons() {
  const volBtn = document.getElementById('toggle-vol-btn');
  const oneRmBtn = document.getElementById('toggle-1rm-btn');
  const infoBtn = document.getElementById('one-rm-info-btn');
  
  if (!volBtn || !oneRmBtn) return;
  
  if (activeChartMode === 'exercise') {
    volBtn.textContent = 'Total Amount Lifted';
    oneRmBtn.textContent = 'One Rep Max';
    if (infoBtn) infoBtn.style.display = 'inline-flex';
  } else {
    volBtn.textContent = 'Daily Volume';
    oneRmBtn.textContent = 'Cumulative Volume';
    if (infoBtn) infoBtn.style.display = 'none';
  }
}

// Load audio settings from localStorage and populate inputs
function loadSoundSettings() {
  const stored = localStorage.getItem('progreso-sound-settings');
  if (stored) {
    try {
      soundSettings = JSON.parse(stored);
    } catch (e) {
      console.error('Error loading sound settings:', e);
    }
  }
  
  // Update UI inputs to match loaded settings
  const typeSelect = document.getElementById('sound-type-select');
  const repeatsSelect = document.getElementById('sound-repeats-select');
  const volSlider = document.getElementById('sound-volume-slider');
  const durSlider = document.getElementById('sound-duration-slider');
  
  if (typeSelect) typeSelect.value = soundSettings.type || 'beep';
  if (repeatsSelect) repeatsSelect.value = String(soundSettings.repeats || 2);
  if (volSlider) {
    volSlider.value = Math.round((soundSettings.volume !== undefined ? soundSettings.volume : 0.8) * 100);
    const volValText = document.getElementById('sound-volume-value');
    if (volValText) volValText.textContent = `${volSlider.value}%`;
  }
  if (durSlider) {
    durSlider.value = Math.round((soundSettings.duration || 0.35) * 100);
    const durValText = document.getElementById('sound-duration-value');
    if (durValText) durValText.textContent = `${(durSlider.value / 100).toFixed(2)}s`;
  }
}

// Save sound configuration to localStorage and update label metrics
function saveSoundSettings() {
  const typeSelect = document.getElementById('sound-type-select');
  const repeatsSelect = document.getElementById('sound-repeats-select');
  const volSlider = document.getElementById('sound-volume-slider');
  const durSlider = document.getElementById('sound-duration-slider');
  
  if (typeSelect) soundSettings.type = typeSelect.value;
  if (repeatsSelect) soundSettings.repeats = parseInt(repeatsSelect.value) || 2;
  if (volSlider) {
    soundSettings.volume = parseFloat(volSlider.value) / 100;
    const volValText = document.getElementById('sound-volume-value');
    if (volValText) volValText.textContent = `${volSlider.value}%`;
  }
  if (durSlider) {
    soundSettings.duration = parseFloat(durSlider.value) / 100;
    const durValText = document.getElementById('sound-duration-value');
    if (durValText) durValText.textContent = `${soundSettings.duration.toFixed(2)}s`;
  }
  
  localStorage.setItem('progreso-sound-settings', JSON.stringify(soundSettings));
}

// Play notification sound using the Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    const repeatCount = soundSettings.repeats || 2;
    const volume = soundSettings.volume !== undefined ? soundSettings.volume : 0.8;
    const duration = soundSettings.duration || 0.35;
    const soundType = soundSettings.type || 'beep';
    
    let startTime = ctx.currentTime;
    
    for (let i = 0; i < repeatCount; i++) {
      const playSoundInstance = (time) => {
        // Main gain node for volume control
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, time);
        // Cap overall volume at a comfortable max level (e.g. 0.25)
        const targetVol = volume * 0.25;
        gain.gain.linearRampToValueAtTime(targetVol, time + 0.015);
        gain.gain.setValueAtTime(targetVol, time + duration - 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        if (soundType === 'beep') {
          const osc = ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, time);
          osc.start(time);
          osc.stop(time + duration);
        } else if (soundType === 'whistle') {
          // Whistle: beating effect with 2 high pitched oscillators + warble LFO
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          
          osc1.connect(gain);
          osc2.connect(gain);
          
          osc1.type = 'sine';
          osc2.type = 'sine';
          
          // High whistle frequencies
          osc1.frequency.setValueAtTime(2000, time);
          osc2.frequency.setValueAtTime(2015, time);
          
          // Modulator LFO for the whistle fluttering vibrato
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          
          lfo.frequency.setValueAtTime(16, time); // 16Hz flutter
          lfoGain.gain.setValueAtTime(35, time);  // Pitch deviation of 35Hz
          
          lfo.connect(lfoGain);
          lfoGain.connect(osc1.frequency);
          lfoGain.connect(osc2.frequency);
          
          lfo.start(time);
          lfo.stop(time + duration);
          osc1.start(time);
          osc2.start(time);
          osc1.stop(time + duration);
          osc2.stop(time + duration);
        }
      };
      
      // Schedule whistle/beep
      playSoundInstance(startTime);
      startTime += duration + 0.15; // Pause between repeats
    }
  } catch (e) {
    console.warn('Audio synthesis failed to execute:', e);
  }
}

// Render Average Lifted Weights section
function renderAverageWeights() {
  const container = document.getElementById('avg-weight-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (!logsData || logsData.length === 0) {
    container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 12px; font-size: 0.9rem;">No workout data available.</div>';
    return;
  }

  // Find the overall latest date in logsData
  let latestDate = new Date(0);
  logsData.forEach(row => {
    if (!row['Date']) return;
    const d = parseDateStr(row['Date']);
    if (d > latestDate) latestDate = d;
  });

  let filteredLogs = [];

  if (activeAvgTimeframe === 'last') {
    // Find the most recent date on which an exercise in the active muscle group was performed
    let lastSessionDateStr = '';
    let lastSessionDate = new Date(0);

    logsData.forEach(row => {
      if (!row['Date'] || !row['Name of Exercise']) return;
      const cat = getExerciseCategory(row['Name of Exercise']);
      if (cat === activeAvgMuscleGroup) {
        const d = parseDateStr(row['Date']);
        if (d > lastSessionDate) {
          lastSessionDate = d;
          lastSessionDateStr = row['Date'];
        }
      }
    });

    if (lastSessionDateStr) {
      filteredLogs = logsData.filter(row => row['Date'] === lastSessionDateStr && getExerciseCategory(row['Name of Exercise']) === activeAvgMuscleGroup);
    }
  } else {
    // 7d or 30d
    const days = activeAvgTimeframe === '7d' ? 7 : 30;
    const cutoffTime = latestDate.getTime() - (days * 24 * 60 * 60 * 1000);
    filteredLogs = logsData.filter(row => {
      if (!row['Date'] || !row['Name of Exercise']) return false;
      const cat = getExerciseCategory(row['Name of Exercise']);
      if (cat !== activeAvgMuscleGroup) return false;
      const d = parseDateStr(row['Date']);
      return d.getTime() >= cutoffTime;
    });
  }

  // Calculate the average weight for each exercise in filteredLogs
  const exerciseWeights = {};

  filteredLogs.forEach(row => {
    const exName = row['Name of Exercise'];
    if (!exName) return;

    if (!exerciseWeights[exName]) {
      exerciseWeights[exName] = [];
    }

    let setIndex = 1;
    while (true) {
      const repsKey = `${setIndex} (reps)`;
      const weightKey = `${setIndex} (kg)`;
      if (row[repsKey] === undefined && setIndex > 4) break;

      const repsVal = row[repsKey] || '';
      const repsInt = parseInt(String(repsVal).match(/\d+/)) || 0;
      
      if (repsInt > 0) {
        const weightVal = row[weightKey] || '';
        const weightNum = parseFloat(String(weightVal || '').replace(/[^\d.]/g, '')) || 0;
        exerciseWeights[exName].push(weightNum);
      }
      setIndex++;
    }
  });

  // Calculate averages and render
  const exercisesToRender = [];
  for (const [exName, weights] of Object.entries(exerciseWeights)) {
    if (weights.length === 0) continue;

    const allZero = weights.every(w => w === 0);
    let avgWeight = 0;
    if (!allZero) {
      const nonZeroWeights = weights.filter(w => w > 0);
      const sum = nonZeroWeights.reduce((a, b) => a + b, 0);
      avgWeight = nonZeroWeights.length > 0 ? sum / nonZeroWeights.length : 0;
    }

    exercisesToRender.push({
      name: exName,
      allZero: allZero,
      avgWeight: avgWeight
    });
  }

  // Sort exercises alphabetically
  exercisesToRender.sort((a, b) => a.name.localeCompare(b.name));

  if (exercisesToRender.length === 0) {
    container.innerHTML = `<div style="color: var(--text-secondary); text-align: center; padding: 12px; font-size: 0.9rem;">No exercises found for ${activeAvgMuscleGroup} in this timeframe.</div>`;
    return;
  }

  exercisesToRender.forEach(ex => {
    const item = document.createElement('div');
    item.className = 'avg-weight-item';
    
    let displayValue = '';
    if (ex.allZero) {
      displayValue = 'Bodyweight';
    } else {
      const val = ex.avgWeight;
      const formattedVal = val % 1 === 0 ? val.toString() : val.toFixed(1);
      displayValue = `${formattedVal} kg`;
    }

    item.innerHTML = `
      <span class="avg-weight-name">${ex.name}</span>
      <span class="avg-weight-value-badge">${displayValue}</span>
    `;
    container.appendChild(item);
  });
}

