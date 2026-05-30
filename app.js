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

// Google OAuth configuration variables
const GOOGLE_CLIENT_ID = '1093893260047-pougu1r4t60k5v6bvsgsf9b9neklutgj.apps.googleusercontent.com';
let googleTokenClient = null;
let googleAccessToken = null;
let pendingSyncAction = null; // 'backup', 'restore', or null

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
let tempReorderExercises = []; // Temp list for reordering active workout session exercises
let draggedIdx = null; // Currently dragged exercise index in reorder modal
let dragStartY = 0; // Starting Y coordinate of pointer drag gesture
let lastReorderPointerEvent = null; // Stores last pointer event for auto-scroll loop
let reorderScrollAnimationFrame = null; // Animation frame reference for auto-scroll loop
let activeEditingPresetIndex = null; // null if creating, number if editing
let presetBuilderStep = 1; // Wizard step tracking
let presetBuilderConfirmDeleteIndex = null; // Track index displaying inline delete confirmation
let workoutPlannerStep = 1; // Workout planner wizard step tracking
let workoutPlannerConfirmDeleteIndex = null; // Track index displaying delete confirmation in planned list
let activeCatalogueCategory = 'Legs';
let activeChartMode = 'exercise'; // 'exercise' or 'muscle'
let activePresetBuilderCategory = 'Legs';
let activeAvgMuscleGroup = 'Back';
let activeAvgTimeframe = 'last';
let restAudio = null;

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
  restAudio = document.getElementById('rest-timer-audio');
  loadTheme();
  loadLogsFromStorage();
  loadCustomData();
  loadSoundSettings();
  setupEventListeners();
  updateDateDisplays();
  updateDashboard();
  updateSeriesToggleButtons();
  
  // Register service worker and persistence API
  registerServiceWorker();
  requestPersistentStorage();
  
  // Initialize Google Auth Sync if library is already loaded
  if (window.googleLibLoaded || (typeof google !== 'undefined' && google.accounts)) {
    initGoogleAuthSync();
  }
  
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
  const tabOrder = ['profile', 'workout', 'analytics'];
  const targetIndex = tabOrder.indexOf(tabName);

  // Check if we are changing tabs
  const currentActiveTabEl = document.querySelector('.nav-item.active');
  const currentTabName = currentActiveTabEl ? currentActiveTabEl.dataset.tab : '';
  const isTabChanging = (currentTabName !== tabName);

  // Hide all tab panels and clear navigation item states
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Activate target panel & tab item
  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }
  
  const targetTab = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Shift viewport to active tab panel (including the 24px gap between panels)
  const viewport = document.getElementById('tabs-viewport');
  if (viewport) {
    viewport.classList.add('transitioning');
    viewport.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    viewport.style.transform = `translateX(calc(-${targetIndex * 100}% - ${targetIndex * 24}px))`;
    
    if (window.tabTransitionTimeout) {
      clearTimeout(window.tabTransitionTimeout);
    }
    window.tabTransitionTimeout = setTimeout(() => {
      viewport.classList.remove('transitioning');
    }, 300);
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

  // Scroll to top of the page when changing tabs
  if (isTabChanging) {
    window.scrollTo(0, 0);
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
      const weightInput = document.getElementById('set-weight-input');
      if (weightInput) {
        weightInput.focus();
      }
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
      if (presetBuilderStep === 1) {
        document.getElementById('preset-builder-modal').classList.remove('active');
      } else {
        presetBuilderStep = 1;
        updatePresetBuilderStepView();
      }
    });
  }
  const presetSaveBtn = document.getElementById('preset-save-btn');
  if (presetSaveBtn) {
    presetSaveBtn.addEventListener('click', () => {
      if (presetBuilderStep === 1) {
        if (presetBuilderExercises.length === 0) {
          alert('Please choose at least one exercise.');
          return;
        }
        presetBuilderStep = 2;
        updatePresetBuilderStepView();
      } else {
        savePreset();
      }
    });
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

  // Catalogue Categories Tab Pills
  document.querySelectorAll('.catalogue-categories .cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.catalogue-categories .cat-pill').forEach(p => p.classList.remove('active'));
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
  const startSessionCircleBtn = document.getElementById('start-session-circle-btn');
  if (startSessionCircleBtn) {
    startSessionCircleBtn.addEventListener('click', openSessionPickerModal);
  }

  const modalStartEmptyBtn = document.getElementById('modal-start-empty-btn');
  if (modalStartEmptyBtn) {
    modalStartEmptyBtn.addEventListener('click', () => {
      requestNotificationPermission();
      activeSession.date = getTodayDateString();
      activeSession.exercises = [];
      workoutPlannerStep = 1; // start at selection for empty
      workoutPlannerConfirmDeleteIndex = null;
      renderPlannedExercisesList();
      renderCatalogueExerciseList();
      updateWorkoutPlannerStepView();
      transitionTo(AppState.PLAN_EXERCISES);
      closeSessionPickerModal();
    });
  }

  const modalClosePickerBtn = document.getElementById('modal-close-picker-btn');
  if (modalClosePickerBtn) {
    modalClosePickerBtn.addEventListener('click', closeSessionPickerModal);
  }

  // Planner actions
  document.getElementById('plan-add-btn').addEventListener('click', addPlannedExercise);
  document.getElementById('plan-ex-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addPlannedExercise();
  });
  document.getElementById('cancel-plan-btn').addEventListener('click', () => {
    if (workoutPlannerStep === 1) {
      transitionTo(AppState.WELCOME);
    } else {
      workoutPlannerStep = 1;
      updateWorkoutPlannerStepView();
    }
  });
  document.getElementById('confirm-plan-btn').addEventListener('click', () => {
    if (workoutPlannerStep === 1) {
      if (activeSession.exercises.length === 0) {
        alert('Please choose at least one exercise.');
        return;
      }
      workoutPlannerStep = 2;
      updateWorkoutPlannerStepView();
    } else {
      if (activeSession.exercises.length === 0) {
        alert('Please add at least one exercise to the routine.');
        return;
      }
      transitionTo(AppState.PLAN_REST);
    }
  });

  // Rest duration screen
  document.getElementById('back-to-plan-btn').addEventListener('click', () => {
    workoutPlannerStep = 2;
    workoutPlannerConfirmDeleteIndex = null;
    renderPlannedExercisesList();
    updateWorkoutPlannerStepView();
    transitionTo(AppState.PLAN_EXERCISES);
  });
  document.getElementById('start-workout-btn').addEventListener('click', () => {
    requestNotificationPermission();
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
  if (testSoundBtn) testSoundBtn.addEventListener('click', () => {
    requestNotificationPermission();
    playNotificationSound();
  });

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

  // Collapsible Rest Timer Sounds Settings
  const toggleSoundBtn = document.getElementById('toggle-sound-settings-btn');
  const soundContainer = document.getElementById('sound-settings-collapse-container');
  const soundArrow = document.getElementById('sound-settings-arrow');

  if (toggleSoundBtn && soundContainer) {
    toggleSoundBtn.addEventListener('click', () => {
      const isOpen = soundContainer.classList.toggle('open');
      if (isOpen) {
        soundContainer.style.maxHeight = '400px';
        soundContainer.style.opacity = '1';
        if (soundArrow) soundArrow.classList.add('rotated');
      } else {
        soundContainer.style.maxHeight = '0px';
        soundContainer.style.opacity = '0';
        if (soundArrow) soundArrow.classList.remove('rotated');
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

  // Swipe navigation detection (finger-following with direction locking)
  let touchStartX = 0;
  let touchStartY = 0;
  let currentTranslateX = 0;
  let isDragging = false;
  let containerWidth = 0;
  let initialTranslateX = 0;
  let gestureChecked = false;
  let isSwipeLock = false;
  let isTouchTracked = false;

  const tabOrder = ['profile', 'workout', 'analytics'];
  const viewport = document.getElementById('tabs-viewport');

  document.addEventListener('touchstart', (e) => {
    isTouchTracked = false;

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
        target.closest('.table-wrapper') ||
        target.closest('.custom-keypad')) {
      return;
    }

    const currentTabEl = document.querySelector('.nav-item.active');
    if (!currentTabEl) return;
    const currentTab = currentTabEl.dataset.tab;
    const currentIndex = tabOrder.indexOf(currentTab);
    if (currentIndex === -1) return;

    isDragging = false;
    gestureChecked = false;
    isSwipeLock = false;
    
    // Get actual width of container
    const container = document.querySelector('.container');
    containerWidth = container ? container.offsetWidth : (window.innerWidth > 480 ? 480 : window.innerWidth);
    
    initialTranslateX = -currentIndex * (containerWidth + 24);
    currentTranslateX = initialTranslateX;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isTouchTracked = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isTouchTracked) return;
    if (gestureChecked && !isSwipeLock) return;
    if (!viewport) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;

    const diffX = touchX - touchStartX;
    const diffY = touchY - touchStartY;

    if (!gestureChecked) {
      const distX = Math.abs(diffX);
      const distY = Math.abs(diffY);
      
      // 8px threshold to lock swipe vs scroll direction
      if (distX > 8 || distY > 8) {
        gestureChecked = true;
        if (distX > distY) {
          isSwipeLock = true;
          isDragging = true;
          viewport.style.transition = 'none';
          viewport.classList.add('transitioning'); // Make all panels visible during swipe drag
        } else {
          isSwipeLock = false;
          isDragging = false;
        }
      }
      return;
    }

    if (isSwipeLock && isDragging) {
      if (e.cancelable) {
        e.preventDefault();
      }

      let targetTranslate = initialTranslateX + diffX;

      // Add elastic boundaries resistance
      if (targetTranslate > 0) {
        targetTranslate = diffX * 0.25;
      } else if (targetTranslate < -2 * (containerWidth + 24)) {
        const overflow = targetTranslate - (-2 * (containerWidth + 24));
        targetTranslate = -2 * (containerWidth + 24) + overflow * 0.25;
      }

      currentTranslateX = targetTranslate;
      viewport.style.transform = `translateX(${currentTranslateX}px)`;
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (!isTouchTracked) return;

    if (isSwipeLock && isDragging && viewport) {
      viewport.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';

      const currentTabEl = document.querySelector('.nav-item.active');
      if (currentTabEl) {
        const currentTab = currentTabEl.dataset.tab;
        const currentIndex = tabOrder.indexOf(currentTab);

        const diffX = e.changedTouches[0].clientX - touchStartX;
        const threshold = containerWidth * 0.25;

        let targetIndex = currentIndex;

        if (diffX < -threshold) {
          if (currentIndex < tabOrder.length - 1) {
            targetIndex = currentIndex + 1;
          }
        } else if (diffX > threshold) {
          if (currentIndex > 0) {
            targetIndex = currentIndex - 1;
          }
        }

        switchTab(tabOrder[targetIndex]);
      } else {
        viewport.classList.remove('transitioning');
      }
    }

    isDragging = false;
    gestureChecked = false;
    isSwipeLock = false;
    isTouchTracked = false;
  }, { passive: true });

  // Detail Modal Event Listeners
  const exDetailCloseBtn = document.getElementById('ex-detail-close-btn');
  const exDetailModal = document.getElementById('exercise-detail-modal');
  if (exDetailCloseBtn && exDetailModal) {
    exDetailCloseBtn.addEventListener('click', () => {
      exDetailModal.classList.remove('active');
      if (activeAnimationId) {
        cancelAnimationFrame(activeAnimationId);
        activeAnimationId = null;
      }
    });
    
    // Close on clicking backdrop
    exDetailModal.addEventListener('click', (e) => {
      if (e.target === exDetailModal) {
        exDetailModal.classList.remove('active');
        if (activeAnimationId) {
          cancelAnimationFrame(activeAnimationId);
          activeAnimationId = null;
        }
      }
    });
  }

  // Add from Detail modal to current active planner or preset builder
  const exDetailAddBtn = document.getElementById('ex-detail-add-btn');
  if (exDetailAddBtn) {
    exDetailAddBtn.addEventListener('click', () => {
      const activeModal = document.getElementById('exercise-detail-modal');
      const exName = document.getElementById('ex-detail-title').textContent;
      
      if (activeModal && exName) {
        // Check if Preset Builder is active
        const presetModal = document.getElementById('preset-builder-modal');
        if (presetModal && presetModal.classList.contains('active')) {
          presetBuilderExercises.push({ name: exName, plannedSets: 4 });
          renderPresetBuilderExercises();
        } else {
          activeSession.exercises.push({ name: exName, plannedSets: 4, actualSets: [] });
          renderPlannedExercisesList();
        }
        
        activeModal.classList.remove('active');
        if (activeAnimationId) {
          cancelAnimationFrame(activeAnimationId);
          activeAnimationId = null;
        }
      }
    });
  }

  // Preset Builder inline Custom Exercise Creator save button
  const presetSaveCustomExBtn = document.getElementById('preset-save-custom-ex-btn');
  if (presetSaveCustomExBtn) {
    presetSaveCustomExBtn.addEventListener('click', savePresetCustomExercise);
  }
  const presetNewCustomExName = document.getElementById('preset-new-custom-ex-name');
  if (presetNewCustomExName) {
    presetNewCustomExName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        savePresetCustomExercise();
      }
    });
  }

  // Active workout session reordering listeners
  document.querySelectorAll('.active-reorder-trigger-btn').forEach(btn => {
    btn.addEventListener('click', openActiveReorderModal);
  });
  
  const activeReorderModal = document.getElementById('active-session-reorder-modal');
  const activeReorderSaveBtn = document.getElementById('active-reorder-save-btn');
  const activeReorderCancelBtn = document.getElementById('active-reorder-cancel-btn');
  
  if (activeReorderSaveBtn) activeReorderSaveBtn.addEventListener('click', saveActiveReorderChanges);
  if (activeReorderCancelBtn) activeReorderCancelBtn.addEventListener('click', closeActiveReorderModal);
  if (activeReorderModal) {
    activeReorderModal.addEventListener('click', (e) => {
      if (e.target === activeReorderModal) {
        closeActiveReorderModal();
      }
    });
  }
}

// Planner Screens Implementation
function addPlannedExercise() {
  const nameInput = document.getElementById('plan-ex-name');
  
  const name = nameInput.value.trim();
  
  if (!name) return;
  
  activeSession.exercises.push({
    name: name,
    plannedSets: 4,
    actualSets: []
  });
  
  nameInput.value = '';
  
  renderPlannedExercisesList();
  nameInput.focus();
}

function renderPlannedExercisesList() {
  const container = document.getElementById('planned-list');
  const confirmBtn = document.getElementById('confirm-plan-btn');
  if (!container) return;
  container.innerHTML = '';
  
  if (activeSession.exercises.length === 0) {
    container.innerHTML = '<p id="empty-plan-msg" style="text-align: center; color: var(--text-secondary); padding: 20px;">No exercises added yet.</p>';
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }
  
  if (confirmBtn) confirmBtn.disabled = false;
  
  activeSession.exercises.forEach((ex, idx) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '8px 12px';
    item.style.background = 'rgba(255,255,255,0.03)';
    item.style.border = '1px solid rgba(255,255,255,0.06)';
    item.style.borderRadius = '10px';
    item.style.marginBottom = '8px';
    
    const isConfirming = (idx === workoutPlannerConfirmDeleteIndex);
    
    item.innerHTML = `
      <div style="flex: 1; min-width: 0; padding-right: 8px;">
        <h4 style="margin:0; font-size:1rem; font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${ex.name}</h4>
      </div>
      <div style="display: flex; align-items: center; shrink: 0;">
        ${isConfirming ? `
          <span style="color:var(--text-secondary); font-size:0.75rem; margin-right:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Remove?</span>
          <!-- Red cross (deny delete) -->
          <button class="btn btn-secondary btn-icon" onclick="cancelWorkoutPlannerDelete()" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); margin-right: 6px;" title="No, cancel">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Green check (confirm delete) -->
          <button class="btn btn-icon" onclick="confirmWorkoutPlannerDelete(${idx})" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: #00e676; border: 1px solid #00e676; color: #000;" title="Yes, delete">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ` : `
          <!-- Sets input next to delete button -->
          <div style="display: flex; align-items: center; margin-right: 12px;">
            <input type="number" min="1" max="20" class="plan-ex-sets-input" data-idx="${idx}" value="${ex.plannedSets}" style="width: 48px; text-align: center; border-radius: 6px; padding: 4px 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-primary); font-size: 0.85rem; font-weight: 600;">
            <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:6px;">sets</span>
          </div>
          <!-- Trash Can button -->
          <button class="btn btn-danger btn-icon" onclick="showWorkoutPlannerDeleteConfirm(${idx})" style="width: 28px; height: 28px; border-radius: 6px; padding:0; display: inline-flex; align-items: center; justify-content: center;">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        `}
      </div>
    `;
    
    // Bind change/input listeners for sets input
    if (!isConfirming) {
      const input = item.querySelector('.plan-ex-sets-input');
      if (input) {
        input.addEventListener('change', (e) => {
          const val = Math.max(1, parseInt(e.target.value) || 4);
          activeSession.exercises[idx].plannedSets = val;
        });
        input.addEventListener('input', (e) => {
          const val = Math.max(1, parseInt(e.target.value) || 1);
          activeSession.exercises[idx].plannedSets = val;
        });
      }
    }
    
    container.appendChild(item);
  });
}

// Inline delete confirmation actions for workout planner
window.showWorkoutPlannerDeleteConfirm = function(idx) {
  workoutPlannerConfirmDeleteIndex = idx;
  renderPlannedExercisesList();
};

window.cancelWorkoutPlannerDelete = function() {
  workoutPlannerConfirmDeleteIndex = null;
  renderPlannedExercisesList();
};

window.confirmWorkoutPlannerDelete = function(idx) {
  activeSession.exercises.splice(idx, 1);
  workoutPlannerConfirmDeleteIndex = null;
  renderPlannedExercisesList();
};

// Updates the Step display and container visibilities for the Workout Exercise Planner wizard
function updateWorkoutPlannerStepView() {
  const step1Container = document.getElementById('workout-planner-step1-container');
  const step2Container = document.getElementById('workout-planner-step2-container');
  const titleEl = document.getElementById('workout-planner-title');
  const cancelBtn = document.getElementById('cancel-plan-btn');
  const confirmBtn = document.getElementById('confirm-plan-btn');
  
  if (!step1Container || !step2Container || !titleEl || !cancelBtn || !confirmBtn) return;
  
  if (workoutPlannerStep === 1) {
    step1Container.style.display = 'block';
    step2Container.style.display = 'none';
    titleEl.textContent = 'Plan Exercises: Step 1 (Choose)';
    cancelBtn.textContent = 'Cancel';
    confirmBtn.textContent = 'Next';
    confirmBtn.disabled = false;
  } else {
    step1Container.style.display = 'none';
    step2Container.style.display = 'block';
    titleEl.textContent = 'Plan Exercises: Step 2 (Review)';
    cancelBtn.textContent = 'Back';
    confirmBtn.textContent = 'Next';
    confirmBtn.disabled = (activeSession.exercises.length === 0);
  }
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
  let nextSetText = '';
  if (isLastSetOfExercise) {
    nextSetText = `Up Next: ${nextEx.name} (Set 1 of ${nextEx.plannedSets})`;
  } else {
    nextSetText = `Up Next: Set ${activeSession.currentSetIndex + 2} of ${currentEx.plannedSets}`;
  }
  subtext.textContent = nextSetText;
  
  let timeLeft = activeSession.restTime;
  const countdownText = document.getElementById('timer-countdown');
  const progressRing = document.getElementById('timer-progress-ring');
  
  countdownText.textContent = formatTime(timeLeft);
  progressRing.style.strokeDashoffset = 0;

  // 1. Play silent audio of the exact rest duration to keep background thread active
  if (restAudio) {
    try {
      restAudio.pause();
      const silentUri = createSilenceWavDataUri(activeSession.restTime);
      restAudio.src = silentUri;
      restAudio.play().catch(err => console.log('Audio autoplay blocked or failed:', err));
      
      // When audio finishes naturally (meaning rest duration is completed)
      restAudio.onended = () => {
        playBeep();
        showTimerFinishedNotification(
          isLastSetOfExercise ? nextEx.name : currentEx.name,
          isLastSetOfExercise ? `Set 1 of ${nextEx.plannedSets}` : `Set ${activeSession.currentSetIndex + 2} of ${currentEx.plannedSets}`
        );
        advanceSession(isLastSetOfExercise);
      };
    } catch (e) {
      console.warn('Background silent audio setup failed:', e);
    }
  }

  // 2. Setup Media Session metadata and actions (so user can view and skip rest timer from lock screen!)
  const updateMediaSession = (remaining) => {
    if ('mediaSession' in navigator && restAudio) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Rest: ${remaining}s remaining`,
        artist: currentEx.name,
        album: 'PROGRESO Workout Tracker',
        artwork: [
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });
      
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        skipRestTimer();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        skipRestTimer();
      });
    }
  };

  updateMediaSession(timeLeft);

  // 3. Setup visual UI timer ticks
  clearInterval(activeSession.timerInterval);
  activeSession.timerInterval = setInterval(() => {
    timeLeft--;
    
    // Safety check: if audio ended or timer reached zero
    if (timeLeft <= 0) {
      clearInterval(activeSession.timerInterval);
      countdownText.textContent = formatTime(0);
      progressRing.style.strokeDashoffset = 502;
      
      if (restAudio && !restAudio.paused) {
        restAudio.pause();
        playBeep();
        showTimerFinishedNotification(
          isLastSetOfExercise ? nextEx.name : currentEx.name,
          isLastSetOfExercise ? `Set 1 of ${nextEx.plannedSets}` : `Set ${activeSession.currentSetIndex + 2} of ${currentEx.plannedSets}`
        );
        advanceSession(isLastSetOfExercise);
      }
      return;
    }

    countdownText.textContent = formatTime(timeLeft);
    
    // Circular progress animation (perimeter=502)
    const progressFraction = timeLeft / activeSession.restTime;
    progressRing.style.strokeDashoffset = 502 - (502 * progressFraction);
    
    // Update lock screen metadata title
    updateMediaSession(timeLeft);
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
  if (restAudio) {
    restAudio.pause();
    restAudio.onended = null;
  }
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('pause', null);
  }

  const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
  const isLastSet = activeSession.currentSetIndex === currentEx.plannedSets - 1;
  advanceSession(isLastSet);
}

function advanceSession(isLastSetOfExercise) {
  clearInterval(activeSession.timerInterval);
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
  
  // Auto-backup to cloud if logged in
  if (googleAccessToken) {
    backupDataToDrive().catch(err => console.error('[PROGRESO] Auto backup failed:', err));
  }
  
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

function openSessionPickerModal() {
  const modal = document.getElementById('session-picker-modal');
  if (modal) {
    modal.classList.add('active');
    renderPresetsOnWelcome();
  }
}

function closeSessionPickerModal() {
  const modal = document.getElementById('session-picker-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Renders presets on the welcome screen
function renderPresetsOnWelcome() {
  const customContainer = document.getElementById('modal-custom-presets-list');
  const defaultContainer = document.getElementById('modal-default-presets-list');
  
  if (customContainer) {
    customContainer.innerHTML = '';
    if (customPresets.length === 0) {
      customContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; font-style: italic; padding: 12px 0; text-align: center; width: 100%;">No custom presets. Create one in the Profile tab!</p>';
    } else {
      customPresets.forEach((preset) => {
        const card = document.createElement('div');
        card.className = 'preset-welcome-card';
        const exCount = preset.exercises.length;
        
        card.innerHTML = `
          <div>
            <div class="p-name">${preset.name}</div>
            <div class="p-desc">${exCount} exercise${exCount === 1 ? '' : 's'} planned</div>
          </div>
          <div class="p-arrow"></div>
        `;
        
        card.addEventListener('click', () => {
          loadPresetIntoSession(preset);
          closeSessionPickerModal();
        });
        
        customContainer.appendChild(card);
      });
    }
  }
  
  if (defaultContainer) {
    defaultContainer.innerHTML = '';
    DEFAULT_PRESETS.forEach((preset) => {
      const card = document.createElement('div');
      card.className = 'preset-welcome-card';
      
      card.innerHTML = `
        <div>
          <div class="p-name">${preset.name}</div>
          <div class="p-desc">${preset.description}</div>
        </div>
        <div class="p-arrow"></div>
      `;
      
      card.addEventListener('click', () => {
        loadPresetIntoSession(preset);
        closeSessionPickerModal();
      });
      
      defaultContainer.appendChild(card);
    });
  }
}

// Load a preset's exercises into the active session planner
function loadPresetIntoSession(preset) {
  requestNotificationPermission();
  activeSession.date = getTodayDateString();
  
  // Clone exercises from preset
  activeSession.exercises = preset.exercises.map(ex => ({
    name: ex.name,
    plannedSets: ex.plannedSets,
    actualSets: []
  }));
  
  workoutPlannerStep = 2; // load preset directly to step 2 review
  workoutPlannerConfirmDeleteIndex = null;
  renderPlannedExercisesList();
  updateWorkoutPlannerStepView();
  transitionTo(AppState.PLAN_EXERCISES);
}

// Opens the preset builder modal
window.openPresetBuilder = function(presetIndex = null) {
  const modal = document.getElementById('preset-builder-modal');
  const titleEl = document.getElementById('preset-modal-title');
  const nameInput = document.getElementById('preset-name-input');
  
  if (!modal || !titleEl || !nameInput) return;
  
  activeEditingPresetIndex = presetIndex;
  presetBuilderStep = 1;
  
  // Clear inputs
  document.getElementById('preset-exercise-search').value = '';
  presetBuilderConfirmDeleteIndex = null;
  
  if (presetIndex === null) {
    nameInput.value = '';
    presetBuilderExercises = [];
  } else {
    const preset = customPresets[presetIndex];
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
  updatePresetBuilderStepView();
  modal.classList.add('active');
}

// Updates the Step display and container visibilities for the Preset Builder wizard
function updatePresetBuilderStepView() {
  const step1Container = document.getElementById('preset-builder-step1-container');
  const step2Container = document.getElementById('preset-builder-step2-container');
  const titleEl = document.getElementById('preset-modal-title');
  const cancelBtn = document.getElementById('preset-cancel-btn');
  const saveBtn = document.getElementById('preset-save-btn');
  
  if (!step1Container || !step2Container || !titleEl || !cancelBtn || !saveBtn) return;
  
  if (presetBuilderStep === 1) {
    step1Container.style.display = 'block';
    step2Container.style.display = 'none';
    const isEdit = activeEditingPresetIndex !== null;
    titleEl.textContent = isEdit ? 'Edit Preset: Step 1 (Exercises)' : 'Create Preset: Step 1 (Exercises)';
    cancelBtn.textContent = 'Cancel';
    saveBtn.textContent = 'Next';
  } else {
    step1Container.style.display = 'none';
    step2Container.style.display = 'block';
    const isEdit = activeEditingPresetIndex !== null;
    titleEl.textContent = isEdit ? 'Edit Preset: Step 2 (Review)' : 'Create Preset: Step 2 (Review)';
    cancelBtn.textContent = 'Back';
    saveBtn.textContent = isEdit ? 'Save Changes' : 'Save Preset';
  }
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
    item.style.borderRadius = '10px';
    item.style.padding = '8px 12px';
    item.style.fontSize = '0.88rem';
    item.style.marginBottom = '6px';
    
    const isConfirming = (idx === presetBuilderConfirmDeleteIndex);
    
    item.innerHTML = `
      <div style="flex: 1; min-width: 0; padding-right: 8px;">
        <span style="font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; display:block;">${ex.name}</span>
      </div>
      <div style="display: flex; align-items: center; shrink: 0;">
        ${isConfirming ? `
          <span style="color:var(--text-secondary); font-size:0.75rem; margin-right:8px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Remove?</span>
          <!-- Red cross (deny delete) -->
          <button class="btn btn-secondary btn-icon" onclick="cancelPresetBuilderDelete()" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-color: rgba(255,255,255,0.15); margin-right: 6px;" title="No, cancel">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Green check (confirm delete) -->
          <button class="btn btn-icon" onclick="confirmPresetBuilderDelete(${idx})" style="width: 28px; height: 28px; border-radius: 6px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: #00e676; border: 1px solid #00e676; color: #000;" title="Yes, delete">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        ` : `
          <!-- Sets input next to delete button -->
          <div style="display: flex; align-items: center; margin-right: 12px;">
            <input type="number" min="1" max="20" class="preset-ex-sets-input" data-idx="${idx}" value="${ex.plannedSets}" style="width: 48px; text-align: center; border-radius: 6px; padding: 4px 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-primary); font-size: 0.85rem; font-weight: 600;">
            <span style="color:var(--text-secondary); font-size:0.8rem; margin-left:6px;">sets</span>
          </div>
          <!-- Trash Can button -->
          <button class="btn btn-danger btn-icon" onclick="showPresetBuilderDeleteConfirm(${idx})" style="width: 28px; height: 28px; border-radius: 6px; padding:0; display: inline-flex; align-items: center; justify-content: center;">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        `}
      </div>
    `;
    
    // Bind change/input listeners for sets input to update planning sets state
    if (!isConfirming) {
      const input = item.querySelector('.preset-ex-sets-input');
      if (input) {
        input.addEventListener('change', (e) => {
          const val = Math.max(1, parseInt(e.target.value) || 4);
          presetBuilderExercises[idx].plannedSets = val;
        });
        input.addEventListener('input', (e) => {
          const val = Math.max(1, parseInt(e.target.value) || 1);
          presetBuilderExercises[idx].plannedSets = val;
        });
      }
    }
    
    listContainer.appendChild(item);
  });
}

// Inline delete confirmation actions
window.showPresetBuilderDeleteConfirm = function(idx) {
  presetBuilderConfirmDeleteIndex = idx;
  renderPresetBuilderExercises();
};

window.cancelPresetBuilderDelete = function() {
  presetBuilderConfirmDeleteIndex = null;
  renderPresetBuilderExercises();
};

window.confirmPresetBuilderDelete = function(idx) {
  presetBuilderExercises.splice(idx, 1);
  presetBuilderConfirmDeleteIndex = null;
  renderPresetBuilderExercises();
};

// Add exercise to preset builder list
function addPresetExercise() {
  const searchInput = document.getElementById('preset-exercise-search');
  
  const name = searchInput.value.trim();
  
  if (!name) return;
  
  presetBuilderExercises.push({ name, plannedSets: 4 });
  searchInput.value = '';
  
  renderPresetBuilderExercises();
  searchInput.focus();
}

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
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-danger') || e.target.closest('.ex-info-btn')) return;
        addCatalogueExercise(ex.name, e);
      });
      
      item.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; overflow:hidden; gap:8px;">
          <span class="ex-name-link" style="font-weight:500; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1;">${ex.name}</span>
          <div style="display:flex; gap:8px; align-items:center; shrink:0;">
            <button class="ex-info-btn" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding: 2px;" onclick="event.stopPropagation(); openExerciseDetail('${ex.name.replace(/'/g, "\\'")}')" title="View details & history">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <button class="btn btn-danger btn-icon" onclick="event.stopPropagation(); deleteCustomExercise(${idx})" style="width:20px; height:20px; border-radius:4px; padding:0; justify-content:center; display:flex; align-items:center;" title="Delete Exercise">
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        if (e.target.closest('.ex-info-btn')) return;
        addCatalogueExercise(ex, e);
      });
      
      item.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; overflow:hidden; gap:8px;">
          <span class="ex-name-link" style="font-weight:500; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1;">${ex}</span>
          <button class="ex-info-btn" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding: 2px; shrink:0;" onclick="event.stopPropagation(); openExerciseDetail('${ex.replace(/'/g, "\\'")}')" title="View details & history">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
        </div>
      `;
      listContainer.appendChild(item);
    });
  }
}

// Add exercise from catalogue list directly to planned exercises
window.addCatalogueExercise = function(name, event) {
  activeSession.exercises.push({
    name: name,
    plannedSets: 4,
    actualSets: []
  });
  
  renderPlannedExercisesList();

  // Flash item to indicate successful add
  if (event && event.currentTarget) {
    const btn = event.currentTarget;
    const parent = btn.closest('.catalogue-item');
    if (parent) {
      parent.classList.add('flash-success');
      setTimeout(() => {
        parent.classList.remove('flash-success');
      }, 400);
    }
  }
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
  const customForm = document.getElementById('preset-custom-exercise-builder');
  if (!container) return;
  container.innerHTML = '';
  
  let exercises = [];
  if (activePresetBuilderCategory === 'Custom') {
    if (customForm) customForm.style.display = 'block';
    exercises = customExercises.map(ex => ex.name);
  } else {
    if (customForm) customForm.style.display = 'none';
    exercises = DEFAULT_CATALOGUE[activePresetBuilderCategory] || [];
  }
  
  if (exercises.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:0.8rem; padding: 10px 0; margin:0;">No exercises found.</p>';
    return;
  }
  
  exercises.forEach(name => {
    const item = document.createElement('div');
    item.className = 'catalogue-item';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '8px 10px';
    item.style.borderRadius = '8px';
    item.style.fontSize = '0.85rem';
    item.style.background = 'rgba(255, 255, 255, 0.02)';
    item.style.border = '1px solid rgba(255, 255, 255, 0.04)';
    item.style.marginBottom = '6px';
    item.style.transition = 'all 0.15s';
    item.style.cursor = 'pointer';
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.ex-info-btn')) return;
      addExerciseToPresetBuilderList(name, e);
    });
    
    item.innerHTML = `
      <span class="ex-name-link" style="color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; font-weight:500;">${name}</span>
      <button class="ex-info-btn" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding: 2px; margin-left: 8px; shrink:0;" onclick="event.stopPropagation(); openExerciseDetail('${name.replace(/'/g, "\\'")}')" title="View details & history">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
    `;
    container.appendChild(item);
  });
}

// Add exercise from preset catalogue to temporary preset builder list
window.addExerciseToPresetBuilderList = function(name, event) {
  presetBuilderExercises.push({ name, plannedSets: 4 });
  renderPresetBuilderExercises();

  // Flash item to indicate successful add
  if (event && event.currentTarget) {
    const parent = event.currentTarget.closest('.catalogue-item');
    if (parent) {
      parent.classList.add('flash-success');
      setTimeout(() => {
        parent.classList.remove('flash-success');
      }, 400);
    }
  }
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

// Background rest timer helper functions
function createSilenceWavDataUri(durationSeconds) {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = Math.ceil(durationSeconds * byteRate);
  const chunkSize = 36 + dataSize;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  /* file length */
  view.setUint32(4, chunkSize, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false); // "WAVE"
  
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, byteRate, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false); // "data"
  /* data chunk length */
  view.setUint32(40, dataSize, true);
  
  // Write silence (for 8-bit unsigned PCM, silence is 128)
  const uint8View = new Uint8Array(buffer, 44, dataSize);
  uint8View.fill(128);
  
  // Convert to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission status:', permission);
    });
  }
}

function showTimerFinishedNotification(exerciseName, nextSetText) {
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification('Rest Finished! 🏋️', {
        body: `Time to start: ${exerciseName} (${nextSetText})`,
        icon: 'icon.svg',
        vibrate: [200, 100, 200],
        badge: 'icon.svg',
        tag: 'rest-timer-notification',
        renotify: true
      });
    });
  }
}

// PWA Update Management and Storage Persistence Helpers
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      console.log('[PROGRESO] Service Worker registered:', reg.scope);
      
      // Force PWA update check on page load to bypass HTTP cache for sw.js
      reg.update();
      
      // If there is an update already waiting, show the banner
      if (reg.waiting) {
        showUpdateBanner(reg.waiting);
      }
      
      // Watch for future updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    }).catch((err) => {
      console.error('[PROGRESO] Service Worker registration failed:', err);
    });
    
    // Page reload upon updating Service Worker
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

function showUpdateBanner(worker) {
  if (document.getElementById('update-banner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position: fixed;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 40px);
    max-width: 440px;
    background: rgba(25, 27, 38, 0.95);
    border: 1px solid var(--accent-color);
    box-shadow: 0 0 20px var(--accent-glow);
    border-radius: 16px;
    padding: 14px 18px;
    z-index: 9999;
    display: flex;
    justify-content: space-between;
    align-items: center;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;
  
  banner.innerHTML = `
    <div style="flex: 1; padding-right: 12px; text-align: left;">
      <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #ffffff;">Update Available! ⚡</h4>
      <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">PROGRESO has a new version ready to apply.</p>
    </div>
    <button class="btn btn-primary" style="padding: 8px 16px; font-size: 0.85rem; border-radius: 10px; font-weight: 700; white-space: nowrap; cursor: pointer;">
      Reload
    </button>
  `;
  
  const button = banner.querySelector('button');
  button.addEventListener('click', () => {
    worker.postMessage({ action: 'skipWaiting' });
  });
  
  document.body.appendChild(banner);
  
  setTimeout(() => {
    banner.style.top = '20px';
  }, 100);
}

function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persisted) => {
      if (persisted) {
        console.log('[PROGRESO] Storage persistence granted. Data is safe from eviction.');
      } else {
        console.warn('[PROGRESO] Storage persistence request was denied by the platform.');
      }
    }).catch((err) => {
      console.error('[PROGRESO] Failed to request storage persistence:', err);
    });
  }
}

function isGoogleTokenValid() {
  if (!googleAccessToken) return false;
  const expiration = parseInt(localStorage.getItem('progreso-google-token-expiration')) || 0;
  return Date.now() < expiration;
}

// Google Cloud Backup & Sync Integration
function initGoogleAuthSync() {
  const saveBtn = document.getElementById('save-client-id-btn');
  const clientIdInput = document.getElementById('google-client-id-input');
  
  if (saveBtn && clientIdInput) {
    saveBtn.addEventListener('click', () => {
      const inputVal = clientIdInput.value.trim();
      if (inputVal) {
        localStorage.setItem('progreso-google-client-id', inputVal);
        initGoogleAuthSync();
      }
    });
  }

  const activeClientId = GOOGLE_CLIENT_ID || localStorage.getItem('progreso-google-client-id');
  
  const setupPrompt = document.getElementById('google-setup-prompt');
  const loggedOutDiv = document.getElementById('google-logged-out');
  const loggedInDiv = document.getElementById('google-logged-in');

  if (!activeClientId) {
    if (setupPrompt) setupPrompt.style.display = 'block';
    if (loggedOutDiv) loggedOutDiv.style.display = 'none';
    if (loggedInDiv) loggedInDiv.style.display = 'none';
    return;
  }

  // Client ID exists, hide setup prompt, show logged out by default
  if (setupPrompt) setupPrompt.style.display = 'none';
  if (loggedOutDiv) loggedOutDiv.style.display = 'block';
  if (loggedInDiv) loggedInDiv.style.display = 'none';

  // Initialize GIS client token mechanism
  try {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      throw new Error("Google Identity Services script is not fully loaded or initialized. Please wait a moment and try refreshing.");
    }

    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: activeClientId,
      scope: 'https://www.googleapis.com/auth/drive.appdata openid profile email',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          if (tokenResponse.error === 'immediate_failed') {
            console.log('[PROGRESO] Silent sign-in required interaction.');
          } else {
            console.error('[PROGRESO] Google Auth callback error:', tokenResponse);
            alert('Google Sign-In Error: ' + (tokenResponse.error_description || tokenResponse.error));
          }
          localStorage.removeItem('progreso-google-signed-in');
          localStorage.removeItem('progreso-google-access-token');
          localStorage.removeItem('progreso-google-token-expiration');
          showLoggedOutSyncUI();
          pendingSyncAction = null;
          return;
        }
        
        googleAccessToken = tokenResponse.access_token;
        const expiresInSeconds = parseInt(tokenResponse.expires_in) || 3600;
        const expirationTime = Date.now() + (expiresInSeconds * 1000) - 60000;
        localStorage.setItem('progreso-google-access-token', googleAccessToken);
        localStorage.setItem('progreso-google-token-expiration', expirationTime);
        localStorage.setItem('progreso-google-signed-in', 'true');
        
        updateGoogleSyncStatus('Fetching user profile...');
        const profileLoaded = await loadGoogleUserProfile();
        if (profileLoaded) {
          updateGoogleSyncStatus('Signed in. Ready to sync.');
          if (pendingSyncAction === 'backup') {
            pendingSyncAction = null;
            backupDataToDrive().catch(err => {
              console.error(err);
              updateGoogleSyncStatus('Backup process encountered an error.');
            });
          } else if (pendingSyncAction === 'restore') {
            pendingSyncAction = null;
            restoreDataFromDrive().catch(err => {
              console.error(err);
              updateGoogleSyncStatus('Restore process encountered an error.');
            });
          }
        } else {
          updateGoogleSyncStatus('Signed in (Profile load failed).');
          pendingSyncAction = null;
        }
      }
    });

    // Wire up buttons
    const loginBtn = document.getElementById('google-login-btn');
    if (loginBtn) {
      loginBtn.onclick = () => {
        if (googleTokenClient) {
          updateGoogleSyncStatus('Connecting to Google...');
          try {
            const savedEmail = localStorage.getItem('progreso-google-user-email');
            googleTokenClient.requestAccessToken({
              login_hint: savedEmail || undefined
            });
          } catch (err) {
            console.error('[PROGRESO] requestAccessToken failed:', err);
            alert('Sign-In request failed (check popup settings): ' + err.message);
            updateGoogleSyncStatus('Request blocked or failed.');
          }
        } else {
          alert('Google Auth Client not initialized. Please verify your Client ID.');
        }
      };
    }

    const logoutBtn = document.getElementById('google-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = handleGoogleLogout;
    }

    const backupBtn = document.getElementById('google-backup-btn');
    if (backupBtn) {
      backupBtn.onclick = () => {
        if (isGoogleTokenValid()) {
          backupDataToDrive().catch(err => {
            console.error(err);
            updateGoogleSyncStatus('Backup process encountered an error.');
          });
        } else {
          pendingSyncAction = 'backup';
          updateGoogleSyncStatus('Refreshing connection...');
          try {
            const savedEmail = localStorage.getItem('progreso-google-user-email');
            googleTokenClient.requestAccessToken({
              login_hint: savedEmail || undefined
            });
          } catch (err) {
            console.error('[PROGRESO] requestAccessToken failed:', err);
            alert('Re-authentication request failed: ' + err.message);
            updateGoogleSyncStatus('Connection refresh failed.');
          }
        }
      };
    }

    const restoreBtn = document.getElementById('google-restore-btn');
    if (restoreBtn) {
      restoreBtn.onclick = () => {
        if (isGoogleTokenValid()) {
          restoreDataFromDrive().catch(err => {
            console.error(err);
            updateGoogleSyncStatus('Restore process encountered an error.');
          });
        } else {
          pendingSyncAction = 'restore';
          updateGoogleSyncStatus('Refreshing connection...');
          try {
            const savedEmail = localStorage.getItem('progreso-google-user-email');
            googleTokenClient.requestAccessToken({
              login_hint: savedEmail || undefined
            });
          } catch (err) {
            console.error('[PROGRESO] requestAccessToken failed:', err);
            alert('Re-authentication request failed: ' + err.message);
            updateGoogleSyncStatus('Connection refresh failed.');
          }
        }
      };
    }

    // Auto sign-in silently or use valid cached token
    const savedToken = localStorage.getItem('progreso-google-access-token');
    const expiration = parseInt(localStorage.getItem('progreso-google-token-expiration')) || 0;
    const savedEmail = localStorage.getItem('progreso-google-user-email');

    if (savedToken && Date.now() < expiration) {
      googleAccessToken = savedToken;
      showCachedUserProfile();
      updateGoogleSyncStatus('Signed in. Ready to sync.');
      loadGoogleUserProfile().catch(() => {});
    } else if (localStorage.getItem('progreso-google-signed-in') === 'true') {
      // Show cached user profile, don't request token automatically on load to avoid popup blockers.
      // Connection will be refreshed seamlessly when the user clicks Backup or Restore.
      showCachedUserProfile();
      updateGoogleSyncStatus('Signed in. Ready to sync.');
    }
  } catch (e) {
    console.error('[PROGRESO] Failed to initialize Google Client:', e);
    updateGoogleSyncStatus('Google Identity library load failed.');
  }
}

function showLoggedOutSyncUI() {
  const loggedOutDiv = document.getElementById('google-logged-out');
  const loggedInDiv = document.getElementById('google-logged-in');
  if (loggedOutDiv) loggedOutDiv.style.display = 'block';
  if (loggedInDiv) loggedInDiv.style.display = 'none';
}

function updateGoogleSyncStatus(text) {
  const statusEl = document.getElementById('google-sync-status');
  if (statusEl) statusEl.textContent = text;
}

async function loadGoogleUserProfile() {
  if (!googleAccessToken) return false;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (res.ok) {
      const profile = await res.json();
      
      // Cache details in local storage
      localStorage.setItem('progreso-google-user-email', profile.email || '');
      localStorage.setItem('progreso-google-user-name', profile.name || '');
      localStorage.setItem('progreso-google-user-picture', profile.picture || '');
      
      const nameEl = document.getElementById('google-user-name');
      const emailEl = document.getElementById('google-user-email');
      const avatarImg = document.getElementById('google-user-avatar');
      const fallbackAvatar = document.getElementById('google-user-no-avatar');
      
      if (nameEl) nameEl.textContent = profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || 'Google User';
      if (emailEl) emailEl.textContent = profile.email || '—';
      
      if (profile.picture && avatarImg) {
        avatarImg.src = profile.picture;
        avatarImg.style.display = 'block';
        if (fallbackAvatar) fallbackAvatar.style.display = 'none';
      } else {
        if (avatarImg) avatarImg.style.display = 'none';
        if (fallbackAvatar) {
          fallbackAvatar.style.display = 'flex';
          const initial = (profile.given_name || profile.name || 'G')[0].toUpperCase();
          fallbackAvatar.textContent = initial;
        }
      }
      
      const loggedOutDiv = document.getElementById('google-logged-out');
      const loggedInDiv = document.getElementById('google-logged-in');
      if (loggedOutDiv) loggedOutDiv.style.display = 'none';
      if (loggedInDiv) loggedInDiv.style.display = 'block';
      return true;
    }
  } catch (err) {
    console.error('[PROGRESO] Failed to load profile:', err);
  }
  return false;
}

function handleGoogleLogout() {
  if (googleAccessToken) {
    try {
      google.accounts.oauth2.revokeToken(googleAccessToken, () => {
        console.log('[PROGRESO] Google Access token revoked.');
      });
    } catch (e) {
      console.warn('Failed to revoke Google token:', e);
    }
  }
  googleAccessToken = null;
  localStorage.removeItem('progreso-google-signed-in');
  localStorage.removeItem('progreso-google-access-token');
  localStorage.removeItem('progreso-google-token-expiration');
  localStorage.removeItem('progreso-google-user-email');
  localStorage.removeItem('progreso-google-user-name');
  localStorage.removeItem('progreso-google-user-picture');
  
  const nameEl = document.getElementById('google-user-name');
  const emailEl = document.getElementById('google-user-email');
  if (nameEl) nameEl.textContent = 'Loading Profile...';
  if (emailEl) emailEl.textContent = '...';
  
  showLoggedOutSyncUI();
  updateGoogleSyncStatus('Signed out.');
}

async function findBackupFileId() {
  if (!googleAccessToken) return null;
  try {
    const q = encodeURIComponent("name = 'progreso_backup.json' and 'appDataFolder' in parents and trashed = false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (e) {
    console.error('[PROGRESO] Error searching Drive file:', e);
  }
  return null;
}

async function backupDataToDrive() {
  if (!googleAccessToken) {
    alert('Please sign in with Google first.');
    return;
  }
  
  const backupBtn = document.getElementById('google-backup-btn');
  const restoreBtn = document.getElementById('google-restore-btn');
  if (backupBtn) backupBtn.disabled = true;
  if (restoreBtn) restoreBtn.disabled = true;
  
  try {
    updateGoogleSyncStatus('Checking existing backups...');
    const fileId = await findBackupFileId();
    
    // Create new unified backup payload containing logs, custom presets, and custom exercises
    const backupPayload = {
      version: 2,
      logs: logsData,
      presets: customPresets,
      customExercises: customExercises
    };
    
    let res;
    if (fileId) {
      updateGoogleSyncStatus('Syncing changes to cloud...');
      res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backupPayload)
      });
    } else {
      updateGoogleSyncStatus('Creating new cloud backup...');
      const fileMetadata = {
        name: 'progreso_backup.json',
        parents: ['appDataFolder']
      };
      const boundary = 'progreso_boundary_upload';
      const delimiter = `\r\n--${boundary}\r\n`;
      const close_delim = `\r\n--${boundary}--`;
      
      const body = 
        delimiter + 
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' + 
        JSON.stringify(fileMetadata) + 
        delimiter + 
        'Content-Type: application/json\r\n\r\n' + 
        JSON.stringify(backupPayload) + 
        close_delim;
        
      res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: body
      });
    }
    
    if (res.ok) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      updateGoogleSyncStatus(`Last Backed Up: ${now}`);
    } else {
      const errText = await res.text();
      console.error('[PROGRESO] Drive upload failed:', errText);
      updateGoogleSyncStatus('Backup failed. Try re-signing in.');
    }
  } catch (err) {
    console.error('[PROGRESO] Backup error:', err);
    updateGoogleSyncStatus('Backup error. Check connection.');
  } finally {
    if (backupBtn) backupBtn.disabled = false;
    if (restoreBtn) restoreBtn.disabled = false;
  }
}

async function restoreDataFromDrive() {
  if (!googleAccessToken) {
    alert('Please sign in with Google first.');
    return;
  }
  
  const backupBtn = document.getElementById('google-backup-btn');
  const restoreBtn = document.getElementById('google-restore-btn');
  if (backupBtn) backupBtn.disabled = true;
  if (restoreBtn) restoreBtn.disabled = true;
  
  try {
    updateGoogleSyncStatus('Searching for backup...');
    const fileId = await findBackupFileId();
    if (!fileId) {
      updateGoogleSyncStatus('No backup file found in cloud.');
      alert('No backup file found in your Google Drive AppData folder. Use "Backup Now" first.');
      return;
    }
    
    updateGoogleSyncStatus('Downloading backup...');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    
    if (res.ok) {
      const backupData = await res.json();
      let cloudLogs = [];
      let cloudPresets = [];
      let cloudCustomExercises = [];
      
      if (Array.isArray(backupData)) {
        // Legacy backup format (just array of logs)
        cloudLogs = backupData;
      } else if (backupData && typeof backupData === 'object') {
        // New unified backup format
        cloudLogs = backupData.logs || [];
        cloudPresets = backupData.presets || [];
        cloudCustomExercises = backupData.customExercises || [];
      }
      
      const replaceChoice = confirm(`Found ${cloudLogs.length} exercises logged and ${cloudPresets.length} custom presets in the cloud.\n\n- Click OK to REPLACE your local history and presets with this cloud backup (recommended to keep devices in sync).\n- Click Cancel to MERGE the cloud backup into your current local history and presets.`);
      
      if (replaceChoice) {
        logsData = cloudLogs;
        customPresets = cloudPresets;
        customExercises = cloudCustomExercises;
        
        sortLogsChronologically();
        saveLogsToStorage();
        saveCustomPresets();
        saveCustomExercises();
        
        renderPresets();
        updateDashboard();
        updateProfileStats();
        
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateGoogleSyncStatus(`Restored (replaced) at ${now}`);
        alert(`Successfully replaced local history and presets with cloud data!`);
      } else {
        mergeLogs(cloudLogs);
        
        // Merge custom presets by name
        const existingPresetNames = new Set(customPresets.map(p => p.name));
        cloudPresets.forEach(p => {
          if (!existingPresetNames.has(p.name)) {
            customPresets.push(p);
          }
        });
        
        // Merge custom exercises by name
        const existingExNames = new Set(customExercises.map(e => e.name || e));
        cloudCustomExercises.forEach(e => {
          const name = e.name || e;
          if (!existingExNames.has(name)) {
            customExercises.push(e);
          }
        });
        
        saveLogsToStorage();
        saveCustomPresets();
        saveCustomExercises();
        
        renderPresets();
        updateDashboard();
        updateProfileStats();
        
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateGoogleSyncStatus(`Restored (merged) at ${now}`);
        alert(`Successfully merged cloud data into local history and presets!`);
      }
    } else {
      updateGoogleSyncStatus('Download failed.');
      alert('Failed to retrieve backup file from Google Drive.');
    }
  } catch (err) {
    console.error('[PROGRESO] Restore error:', err);
    updateGoogleSyncStatus('Restore error. Check connection.');
  } finally {
    if (backupBtn) backupBtn.disabled = false;
    if (restoreBtn) restoreBtn.disabled = false;
  }
}

function showCachedUserProfile() {
  const name = localStorage.getItem('progreso-google-user-name') || 'Google User';
  const email = localStorage.getItem('progreso-google-user-email') || '';
  const picture = localStorage.getItem('progreso-google-user-picture') || '';
  
  const nameEl = document.getElementById('google-user-name');
  const emailEl = document.getElementById('google-user-email');
  const avatarImg = document.getElementById('google-user-avatar');
  const fallbackAvatar = document.getElementById('google-user-no-avatar');
  
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  
  if (picture && avatarImg) {
    avatarImg.src = picture;
    avatarImg.style.display = 'block';
    if (fallbackAvatar) fallbackAvatar.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (fallbackAvatar) {
      fallbackAvatar.style.display = 'flex';
      fallbackAvatar.textContent = (name || 'G')[0].toUpperCase();
    }
  }
  
  const loggedOutDiv = document.getElementById('google-logged-out');
  const loggedInDiv = document.getElementById('google-logged-in');
  if (loggedOutDiv) loggedOutDiv.style.display = 'none';
  if (loggedInDiv) loggedInDiv.style.display = 'block';
}

// Global callback for async script loading
window.onGoogleLibraryLoad = function() {
  console.log('[PROGRESO] Google GIS Library loaded.');
  initGoogleAuthSync();
};

// ==========================================
// EXERCISE DETAIL, BIO-GRAPHICS & STATISTICS
// ==========================================

const EXERCISE_DETAILS = {
  // Legs
  'Squats': {
    instructions: '1. Position barbell on your upper back, gripping it firmly.\n2. Stand with feet shoulder-width apart, toes pointed slightly out.\n3. Lower your hips by bending knees until your thighs are parallel to the floor (or lower).\n4. Drive back up to the starting position, keeping your core braced and chest tall.',
    primary: 'Quadriceps, Gluteus Maximus',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Romanian Deadlifts': {
    instructions: '1. Hold a barbell or dumbbells at hip height.\n2. Keep your back flat and hinge at the hips, pushing them straight back.\n3. Lower the weight along your shins until you feel a deep stretch in your hamstrings.\n4. Squeeze your glutes and hamstrings to stand back up.',
    primary: 'Hamstrings, Gluteus Maximus',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Leg Extensions': {
    instructions: '1. Sit in the machine with shins behind the roller pad.\n2. Extend legs fully, squeezing your quadriceps at the top of the motion.\n3. Pause briefly, then slowly lower the weights back to the start.',
    primary: 'Quadriceps',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Leg Curls': {
    instructions: '1. Lie or sit on the machine with roller pad against lower calves.\n2. Bend knees to curl pad towards your glutes, squeezing your hamstrings.\n3. Pause, then slowly return to the starting position.',
    primary: 'Hamstrings',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Calf Raises': {
    instructions: '1. Place balls of feet on platform, heels hanging off.\n2. Press up through your toes, raising heels as high as possible.\n3. Pause at the top, then slowly lower heels below platform level.',
    primary: 'Gastrocnemius, Soleus (Calves)',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Lunges': {
    instructions: '1. Step forward with one leg, keeping your feet hip-width apart.\n2. Lower your hips until your back knee is near the floor and front thigh is parallel to the ground.\n3. Push off your front foot to return to the starting position.',
    primary: 'Quadriceps, Glutes',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  'Bulgarian Split Squats': {
    instructions: '1. Place your back foot on a bench behind you, standing on your front leg.\n2. Lower your hips until your front thigh is parallel to the floor.\n3. Press back up through your front heel, focusing the effort on the front leg.',
    primary: 'Quadriceps, Glutes',
    area: 'Lower Body',
    animationType: 'SQUAT'
  },
  // Chest
  'Barbell Bench Press': {
    instructions: '1. Lie flat on bench, grip barbell slightly wider than shoulder width.\n2. Lower bar under control to mid-chest level.\n3. Press the bar vertically until your arms are fully extended.',
    primary: 'Pectoralis Major (Chest)',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  'Dumbbell Bench Press': {
    instructions: '1. Lie on bench holding dumbbells at chest level with neutral or overhand grip.\n2. Press dumbbells vertically until arms are extended.\n3. Lower weights under control to chest level.',
    primary: 'Pectoralis Major (Chest)',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  'Incline Dumbbell Press': {
    instructions: '1. Set bench to 30-45 degree incline.\n2. Hold dumbbells at shoulders and press upward over your upper chest.\n3. Lower slowly back to the starting position.',
    primary: 'Upper Pectorals, Anterior Deltoids',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  'Chest Flyes': {
    instructions: '1. Lie on bench holding dumbbells above chest, elbows slightly bent.\n2. Lower weights in a wide arc until a stretch is felt in your chest.\n3. Squeeze chest to pull dumbbells back to the start, keeping elbow angle locked.',
    primary: 'Pectoralis Major (Chest)',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  'Push-ups': {
    instructions: '1. Place hands shoulder-width apart in a plank position.\n2. Lower your body in a straight line until your chest nearly touches the floor.\n3. Press back up to the start, keeping your core braced and hips level.',
    primary: 'Pectoralis Major, Triceps',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  'Dips': {
    instructions: '1. Support body weight on dip bars with straight arms.\n2. Lower your body by bending elbows until upper arms are parallel to the floor.\n3. Press back up to lock out, keeping torso leaning slightly forward for chest focus.',
    primary: 'Pectoralis Major, Triceps, Shoulders',
    area: 'Upper Body',
    animationType: 'BENCH_PRESS'
  },
  // Back
  'Barbell Rows': {
    instructions: '1. Grip barbell with overhand grip, hinge forward at hips with flat back.\n2. Pull barbell up to your lower chest/upper stomach, drawing elbows back.\n3. Squeeze shoulder blades, then lower under control.',
    primary: 'Latissimus Dorsi (Lats), Rhomboids',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  'Pull-ups': {
    instructions: '1. Hang from bar with palms facing away from you (overhand grip).\n2. Pull your chest up to the bar, leading with your chest and keeping elbows down.\n3. Slowly lower back down to a full hang.',
    primary: 'Latissimus Dorsi (Lats), Upper Back',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  'Lat Pulldowns': {
    instructions: '1. Sit at machine, pull bar down to upper chest level.\n2. Keep elbows aligned under the bar, pulling them down toward your ribs.\n3. Control the weight back up to a full arm extension.',
    primary: 'Latissimus Dorsi (Lats)',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  'Seated Cable Rows': {
    instructions: '1. Sit with feet on platform, knees slightly bent. Hold handle.\n2. Pull handle to midsection, keeping spine straight and squeezing back.\n3. Extend arms fully, feeling a stretch in your lat muscles.',
    primary: 'Latissimus Dorsi (Lats), Rhomboids',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  'Deadlifts': {
    instructions: '1. Stand with mid-foot under barbell. Bend at hips and knees, grip bar.\n2. Keep back flat, chest up, and drive through heels to pull the bar up along your legs.\n3. Stand tall, squeezing glutes at lockout. Return bar close to legs.',
    primary: 'Erector Spinae (Lower Back), Hamstrings, Glutes',
    area: 'Full Body',
    animationType: 'ROW'
  },
  'Face Pulls': {
    instructions: '1. Hold rope attachment with thumbs facing backwards.\n2. Pull rope to forehead/ears, flaring elbows out and squeezing rear delts.\n3. Return under control.',
    primary: 'Rear Deltoids, Trapezius',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  // Arms
  'Bicep Curls': {
    instructions: '1. Hold dumbbells at sides, palms facing forward. Keep elbows pinned to ribs.\n2. Curl weights up towards shoulders, contracting your biceps.\n3. Pause, then lower weights slowly back to the starting position.',
    primary: 'Biceps Brachii',
    area: 'Upper Body',
    animationType: 'CURL'
  },
  'Hammer Curls': {
    instructions: '1. Hold dumbbells at sides with neutral grip (palms facing each other).\n2. Curl weights up while keeping palms facing in.\n3. Squeeze forearm and bicep muscles, then lower under control.',
    primary: 'Brachialis, Biceps Brachii',
    area: 'Upper Body',
    animationType: 'CURL'
  },
  'Tricep Pushdowns': {
    instructions: '1. Hold cable attachment at chest level, elbows pinned to your sides.\n2. Press bar/rope down until arms are locked out. Squeeze triceps.\n3. Return slowly to upper chest level without moving elbows.',
    primary: 'Triceps Brachii',
    area: 'Upper Body',
    animationType: 'TRICEP'
  },
  'Overhead Tricep Extensions': {
    instructions: '1. Hold dumbbell or cable attachment overhead with straight arms.\n2. Lower the weight behind your head by bending only at the elbows.\n3. Press the weight back up to lock out, contracting your triceps.',
    primary: 'Triceps Brachii',
    area: 'Upper Body',
    animationType: 'TRICEP'
  },
  'Chin-ups': {
    instructions: '1. Hang from bar with underhand grip (palms facing you) shoulder-width apart.\n2. Pull chest to the bar, keeping core braced.\n3. Lower under control to a dead hang.',
    primary: 'Biceps Brachii, Latissimus Dorsi',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  // Shoulders
  'Overhead Shoulder Press': {
    instructions: '1. Hold barbell or dumbbells at shoulder height, standing tall.\n2. Press the weight vertically overhead until your arms are fully locked.\n3. Lower under control back to shoulder level.',
    primary: 'Anterior Deltoids, Triceps',
    area: 'Upper Body',
    animationType: 'PRESS'
  },
  'Lateral Raises': {
    instructions: '1. Hold dumbbells at sides, lean slightly forward.\n2. Raise arms out to the sides until they are parallel to the floor, leading with elbows.\n3. Lower weights slowly back to starting position.',
    primary: 'Lateral Deltoids (Side Shoulders)',
    area: 'Upper Body',
    animationType: 'PRESS'
  },
  'Front Raises': {
    instructions: '1. Hold dumbbells in front of thighs.\n2. Raise weights straight forward until arms are parallel to the floor.\n3. Lower under control, keeping arms straight.',
    primary: 'Anterior Deltoids (Front Shoulders)',
    area: 'Upper Body',
    animationType: 'PRESS'
  },
  'Rear Delt Flyes': {
    instructions: '1. Hinge forward at hips, back flat. Hold dumbbells below chest.\n2. Raise dumbbells out to the sides, leading with elbows and squeezing rear deltoids.\n3. Lower weights slowly back to start.',
    primary: 'Rear Deltoids, Trapezius',
    area: 'Upper Body',
    animationType: 'ROW'
  },
  // Core
  'Planks': {
    instructions: '1. Support body weight on forearms and toes.\n2. Keep your body in a straight line from head to heels.\n3. Brace your core and glutes tightly, holding the position for time.',
    primary: 'Rectus Abdominis, Transverse Abdominis',
    area: 'Core',
    animationType: 'CRUNCH'
  },
  'Crunches': {
    instructions: '1. Lie on your back with knees bent, feet flat on the floor.\n2. Place hands lightly behind head or crossed on chest.\n3. Contract your abdominal muscles to lift your shoulders off the floor. Lower slowly.',
    primary: 'Rectus Abdominis (Abs)',
    area: 'Core',
    animationType: 'CRUNCH'
  },
  'Hanging Leg Raises': {
    instructions: '1. Hang from a bar with straight arms.\n2. Keep legs straight and raise them until they are parallel to the floor (or bend knees to chest).\n3. Lower under control, avoiding any swinging.',
    primary: 'Rectus Abdominis, Iliopsoas (Hip Flexors)',
    area: 'Core',
    animationType: 'CRUNCH'
  },
  'Halos': {
    instructions: '1. Hold a dumbbell or kettlebell upside down at chest height.\n2. Circle the weight around your head, keeping it close to your neck.\n3. Complete the circle and reverse direction, keeping core braced.',
    primary: 'Core, Shoulders',
    area: 'Core',
    animationType: 'CRUNCH'
  },
  'Russian Twists': {
    instructions: '1. Sit on floor, knees bent, leaning back slightly, feet elevated.\n2. Hold weight at chest, twist your torso side to side.\n3. Touch the weight or hands to the floor on each side under control.',
    primary: 'Obliques, Rectus Abdominis',
    area: 'Core',
    animationType: 'CRUNCH'
  }
};

let activeAnimationId = null;

// Opens the exercise detail modal and loads instructions, stats, and historical logs
window.openExerciseDetail = function(exerciseName) {
  const modal = document.getElementById('exercise-detail-modal');
  const titleEl = document.getElementById('ex-detail-title');
  const categoryEl = document.getElementById('ex-detail-category-badge');
  const instructionsEl = document.getElementById('ex-detail-instructions');
  const maxWeightEl = document.getElementById('ex-detail-max-weight');
  const maxOneRmEl = document.getElementById('ex-detail-max-onerm');
  const historyContainer = document.getElementById('ex-detail-history');
  
  if (!modal || !titleEl || !categoryEl || !instructionsEl) return;
  
  titleEl.textContent = exerciseName;
  
  const category = getExerciseCategory(exerciseName);
  categoryEl.textContent = category;
  
  // Set instructions
  const detail = EXERCISE_DETAILS[exerciseName];
  if (detail) {
    instructionsEl.textContent = detail.instructions;
    document.getElementById('ex-detail-primary-muscle').textContent = detail.primary;
    document.getElementById('ex-detail-target-area').textContent = detail.area;
  } else {
    // Custom exercise default text
    instructionsEl.textContent = "1. Maintain proper form and control throughout the entire movement.\n2. Work through a full range of motion, focusing on the target muscle group.\n3. Keep your core braced and breathe out on exertion.";
    document.getElementById('ex-detail-primary-muscle').textContent = category;
    document.getElementById('ex-detail-target-area').textContent = category === 'Legs' ? 'Lower Body' : 'Upper Body';
  }
  
  // Query stats & history
  let maxWeight = 0;
  let max1RM = 0;
  const matchLogs = [];
  
  logsData.forEach(row => {
    if (row['Name of Exercise'] && row['Name of Exercise'].toLowerCase() === exerciseName.toLowerCase()) {
      matchLogs.push(row);
      
      let setIdx = 1;
      while (true) {
        const kgKey = `${setIdx} (kg)`;
        const repsKey = `${setIdx} (reps)`;
        if (row[kgKey] === undefined && row[repsKey] === undefined && setIdx > 4) break;
        
        const kgVal = parseFloat(row[kgKey]) || 0;
        const repsVal = row[repsKey] || '';
        const repsInt = parseInt(String(repsVal).match(/\d+/)) || 0;
        
        if (kgVal > maxWeight) {
          maxWeight = kgVal;
        }
        if (repsInt > 0) {
          const onerm = calculateOneRepMax(kgVal, repsVal);
          if (onerm > max1RM) {
            max1RM = onerm;
          }
        }
        setIdx++;
      }
    }
  });
  
  // Update stats display
  maxWeightEl.textContent = maxWeight > 0 ? `${maxWeight} kg` : '—';
  maxOneRmEl.textContent = max1RM > 0 ? `${Math.round(max1RM * 10) / 10} kg` : '—';
  
  // Populate recent history (last 3 entries)
  historyContainer.innerHTML = '';
  const recentLogs = matchLogs.slice(-3).reverse();
  
  if (recentLogs.length === 0) {
    historyContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 10px; margin: 0;">No workout logs for this exercise yet.</p>';
  } else {
    recentLogs.forEach(row => {
      const item = document.createElement('div');
      item.className = 'detail-history-item';
      
      // format sets reps
      const setStrings = [];
      for (let s = 1; s <= 10; s++) {
        const kg = row[`${s} (kg)`];
        const reps = row[`${s} (reps)`];
        if (reps !== undefined && reps !== '') {
          if (kg !== undefined && kg !== '' && kg !== '0') {
            setStrings.push(`${kg}kg×${reps}`);
          } else {
            setStrings.push(`${reps}r`);
          }
        }
      }
      
      item.innerHTML = `
        <span class="detail-history-date">${row['Date']}</span>
        <span class="detail-history-sets">${setStrings.join(', ')}</span>
      `;
      historyContainer.appendChild(item);
    });
  }
  
  // Show modal
  modal.classList.add('active');
  
  // Start animation loop
  startExerciseAnimation(exerciseName, category);
};

// Starts the dynamic procedural 2D canvas skeleton animation loop
function startExerciseAnimation(exerciseName, category) {
  const canvas = document.getElementById('exercise-detail-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (activeAnimationId) {
    cancelAnimationFrame(activeAnimationId);
    activeAnimationId = null;
  }
  
  const normalizedCategory = (category || 'Core').trim();
  
  // Map standard exercises to animations
  let animationType = 'SQUAT';
  const detail = EXERCISE_DETAILS[exerciseName];
  if (detail && detail.animationType) {
    animationType = detail.animationType;
  } else {
    if (normalizedCategory === 'Legs') animationType = 'SQUAT';
    else if (normalizedCategory === 'Chest') animationType = 'BENCH_PRESS';
    else if (normalizedCategory === 'Back') animationType = 'ROW';
    else if (normalizedCategory === 'Arms') {
      if (exerciseName.toLowerCase().includes('tricep')) {
        animationType = 'TRICEP';
      } else {
        animationType = 'CURL';
      }
    } else if (normalizedCategory === 'Shoulders') {
      animationType = 'PRESS';
    } else {
      animationType = 'CRUNCH';
    }
  }

  let startTime = Date.now();

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get colors from CSS variables dynamically
    const bodyStyles = getComputedStyle(document.body);
    const accentColor = bodyStyles.getPropertyValue('--accent-color').trim() || '#bd00ff';
    const accentGlow = bodyStyles.getPropertyValue('--accent-glow').trim() || 'rgba(189, 0, 255, 0.4)';
    
    // Draw glowing grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (let x = 30; x < canvas.width; x += 30) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let y = 30; y < canvas.height; y += 30) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    
    // Ground floor line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(15, 202);
    ctx.lineTo(canvas.width - 15, 202);
    ctx.stroke();
    
    // Math Phase
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = 2.4;
    const t = elapsed * speed;
    const phase = (Math.sin(t) + 1) / 2; // cycles 0 to 1
    
    // Line Styles
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (animationType === 'SQUAT') {
      const ankle = { x: 140, y: 198 };
      const knee = { x: 140 + phase * 32, y: 160 + phase * 4 };
      const hip = { x: 135 - phase * 30, y: 118 + phase * 42 };
      const shoulder = { x: 140 - phase * 22, y: 72 + phase * 42 };
      const neck = { x: shoulder.x + 4, y: shoulder.y - 12 };
      const head = { x: neck.x + 2, y: neck.y - 14 };
      const elbow = { x: shoulder.x + 25 - phase * 5, y: shoulder.y + 12 - phase * 10 };
      const wrist = { x: elbow.x + 20 + phase * 5, y: elbow.y - 3 };
      
      // Draw background limbs
      const lAnkle = { x: ankle.x - 12, y: ankle.y };
      const lKnee = { x: knee.x - 12, y: knee.y };
      const lHip = { x: hip.x - 12, y: hip.y };
      drawSkeletonLine(ctx, lAnkle, lKnee, 'rgba(255,255,255,0.15)', 2);
      drawSkeletonLine(ctx, lKnee, lHip, 'rgba(255,255,255,0.15)', 2);
      
      const lShoulder = { x: shoulder.x - 8, y: shoulder.y };
      const lElbow = { x: elbow.x - 8, y: elbow.y };
      const lWrist = { x: wrist.x - 8, y: wrist.y };
      drawSkeletonLine(ctx, lShoulder, lElbow, 'rgba(255,255,255,0.12)', 2);
      drawSkeletonLine(ctx, lElbow, lWrist, 'rgba(255,255,255,0.12)', 2);
      
      // Muscle highlight: Quads & Glutes
      ctx.shadowBlur = 18;
      drawMuscleCapsule(ctx, hip, knee, 11, accentGlow);
      ctx.fillStyle = accentGlow;
      ctx.beginPath();
      ctx.arc(hip.x - 8, hip.y + 4, 11 + phase * 2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw foreground skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, ankle, knee, accentColor, 3);
      drawSkeletonLine(ctx, knee, hip, accentColor, 3);
      drawSkeletonLine(ctx, hip, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2.5);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Joints
      drawJointNode(ctx, ankle, accentColor, 3.5);
      drawJointNode(ctx, knee, accentColor, 3.5);
      drawJointNode(ctx, hip, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3);
      
    } else if (animationType === 'BENCH_PRESS') {
      const benchY = 160;
      const hip = { x: 120, y: benchY };
      const shoulder = { x: 180, y: benchY };
      const neck = { x: 195, y: benchY };
      const head = { x: 210, y: benchY };
      const knee = { x: 105, y: benchY + 25 };
      const foot = { x: 112, y: benchY + 42 };
      
      const wrist = { x: 180, y: 135 - phase * 40 };
      const elbow = { x: 165 + phase * 15, y: 175 - phase * 40 };
      
      // Draw bench support
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(90, benchY + 6);
      ctx.lineTo(210, benchY + 6);
      ctx.moveTo(150, benchY + 6);
      ctx.lineTo(150, 202);
      ctx.stroke();
      
      // Muscle highlight: Pectorals
      ctx.shadowBlur = 18;
      const chestPos = { x: (shoulder.x + hip.x) / 2 + 12, y: shoulder.y - 12 };
      ctx.fillStyle = accentGlow;
      ctx.beginPath();
      ctx.arc(chestPos.x, chestPos.y, 11 + phase * 2, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, foot, knee, 'rgba(255,255,255,0.22)', 2);
      drawSkeletonLine(ctx, knee, hip, 'rgba(255,255,255,0.22)', 2);
      drawSkeletonLine(ctx, hip, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2.5);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      // Barbell end cross section and plate
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(wrist.x, wrist.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.rect(wrist.x - 3, wrist.y - 15, 6, 30);
      ctx.fill();
      
      drawJointNode(ctx, hip, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3.5);
      drawJointNode(ctx, elbow, accentColor, 3);
      
    } else if (animationType === 'ROW') {
      const foot = { x: 130, y: 198 };
      const knee = { x: 122, y: 170 };
      const hip = { x: 110, y: 138 };
      const shoulder = { x: 165, y: 112 };
      const neck = { x: 176, y: 104 };
      const head = { x: 188, y: 96 };
      
      const wrist = { x: 165 - phase * 23, y: 165 - phase * 43 };
      const elbow = { x: 145 - phase * 27, y: 145 - phase * 37 };
      
      // Muscle highlight: Back/Lats
      ctx.shadowBlur = 18;
      drawMuscleCapsule(ctx, hip, shoulder, 10, accentGlow);
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, foot, knee, accentColor, 3);
      drawSkeletonLine(ctx, knee, hip, accentColor, 3);
      drawSkeletonLine(ctx, hip, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2.5);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      // Barbell weight plate
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(wrist.x, wrist.y, 11, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      drawJointNode(ctx, foot, accentColor, 3.5);
      drawJointNode(ctx, knee, accentColor, 3.5);
      drawJointNode(ctx, hip, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3.5);
      drawJointNode(ctx, elbow, accentColor, 3);
      
    } else if (animationType === 'CURL') {
      const foot = { x: 150, y: 198 };
      const knee = { x: 150, y: 162 };
      const hip = { x: 150, y: 126 };
      const shoulder = { x: 150, y: 78 };
      const neck = { x: 150, y: 66 };
      const head = { x: 150, y: 50 };
      const elbow = { x: 150, y: 108 };
      const wrist = { x: 150 + phase * 22, y: 140 - phase * 54 };
      
      // Muscle highlight: Biceps (swelling)
      ctx.shadowBlur = 18;
      const bicepWidth = 7.5 + phase * 5;
      drawMuscleCapsule(ctx, shoulder, elbow, bicepWidth, accentGlow);
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, foot, knee, accentColor, 3);
      drawSkeletonLine(ctx, knee, hip, accentColor, 3);
      drawSkeletonLine(ctx, hip, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2.5);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      // Dumbbell
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wrist.x - 10, wrist.y - 4);
      ctx.lineTo(wrist.x + 10, wrist.y + 4);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(wrist.x - 10, wrist.y - 4, 5, 0, 2 * Math.PI);
      ctx.arc(wrist.x + 10, wrist.y + 4, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      drawJointNode(ctx, foot, accentColor, 3.5);
      drawJointNode(ctx, hip, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3.5);
      drawJointNode(ctx, elbow, accentColor, 3.5);
      
    } else if (animationType === 'TRICEP') {
      const foot = { x: 150, y: 198 };
      const knee = { x: 150, y: 162 };
      const hip = { x: 150, y: 126 };
      const shoulder = { x: 150, y: 78 };
      const neck = { x: 150, y: 66 };
      const head = { x: 150, y: 50 };
      const elbow = { x: 150, y: 108 };
      const wrist = { x: 150 + (1 - phase) * 15, y: 115 + phase * 32 };
      
      // Muscle highlight: Triceps (back of arm)
      ctx.shadowBlur = 18;
      const tricepWidth = 8.5 + (1 - phase) * 3;
      ctx.fillStyle = accentGlow;
      ctx.beginPath();
      ctx.arc(shoulder.x - 6, (shoulder.y + elbow.y) / 2, tricepWidth, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, foot, knee, accentColor, 3);
      drawSkeletonLine(ctx, knee, hip, accentColor, 3);
      drawSkeletonLine(ctx, hip, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2.5);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      // Handle bar
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(wrist.x, wrist.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      
      drawJointNode(ctx, foot, accentColor, 3.5);
      drawJointNode(ctx, hip, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3.5);
      drawJointNode(ctx, elbow, accentColor, 3.5);
      
    } else if (animationType === 'PRESS') {
      const lFoot = { x: 130, y: 198 };
      const rFoot = { x: 170, y: 198 };
      const lHip = { x: 135, y: 130 };
      const rHip = { x: 165, y: 130 };
      const spine = { x: 150, y: 130 };
      const shoulderCenter = { x: 150, y: 80 };
      const head = { x: 150, y: 55 };
      const lShoulder = { x: 125, y: 80 };
      const rShoulder = { x: 175, y: 80 };
      
      const isLateral = exerciseName.toLowerCase().includes('lateral') || exerciseName.toLowerCase().includes('rear') || exerciseName.toLowerCase().includes('front') || exerciseName.toLowerCase().includes('raise');
      
      let lElbow, rElbow, lWrist, rWrist;
      
      if (isLateral) {
        lWrist = { x: 125 - phase * 32, y: 120 - phase * 42 };
        rWrist = { x: 175 + phase * 32, y: 120 - phase * 42 };
        lElbow = { x: 125 - phase * 18, y: 100 - phase * 20 };
        rElbow = { x: 175 + phase * 18, y: 100 - phase * 20 };
      } else {
        lWrist = { x: 125, y: 85 - phase * 50 };
        rWrist = { x: 175, y: 85 - phase * 50 };
        lElbow = { x: 112 + phase * 10, y: 105 - phase * 50 };
        rElbow = { x: 188 - phase * 10, y: 105 - phase * 50 };
      }
      
      // Muscle highlight: Deltoids
      ctx.shadowBlur = 18;
      ctx.fillStyle = accentGlow;
      ctx.beginPath();
      ctx.arc(lShoulder.x, lShoulder.y, 7.5, 0, 2 * Math.PI);
      ctx.arc(rShoulder.x, rShoulder.y, 7.5, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, lFoot, lHip, 'rgba(255,255,255,0.2)', 2);
      drawSkeletonLine(ctx, rFoot, rHip, 'rgba(255,255,255,0.2)', 2);
      drawSkeletonLine(ctx, lHip, rHip, 'rgba(255,255,255,0.2)', 2);
      drawSkeletonLine(ctx, spine, shoulderCenter, accentColor, 3);
      drawSkeletonLine(ctx, lShoulder, rShoulder, accentColor, 3);
      drawSkeletonLine(ctx, lShoulder, lElbow, accentColor, 2.5);
      drawSkeletonLine(ctx, rShoulder, rElbow, accentColor, 2.5);
      drawSkeletonLine(ctx, lElbow, lWrist, accentColor, 2.5);
      drawSkeletonLine(ctx, rElbow, rWrist, accentColor, 2.5);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      if (!isLateral) {
        // Barbell
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(lWrist.x - 16, lWrist.y);
        ctx.lineTo(rWrist.x + 16, rWrist.y);
        ctx.stroke();
        
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.rect(lWrist.x - 20, lWrist.y - 12, 4, 24);
        ctx.rect(rWrist.x + 16, rWrist.y - 12, 4, 24);
        ctx.fill();
      } else {
        // Dumbbells
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(lWrist.x - 6, lWrist.y);
        ctx.lineTo(lWrist.x + 6, lWrist.y);
        ctx.moveTo(rWrist.x - 6, rWrist.y);
        ctx.lineTo(rWrist.x + 6, rWrist.y);
        ctx.stroke();
        
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(lWrist.x - 6, lWrist.y, 3.5, 0, 2 * Math.PI);
        ctx.arc(lWrist.x + 6, lWrist.y, 3.5, 0, 2 * Math.PI);
        ctx.arc(rWrist.x - 6, rWrist.y, 3.5, 0, 2 * Math.PI);
        ctx.arc(rWrist.x + 6, rWrist.y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      drawJointNode(ctx, lShoulder, accentColor, 3.5);
      drawJointNode(ctx, rShoulder, accentColor, 3.5);
      drawJointNode(ctx, lElbow, accentColor, 3);
      drawJointNode(ctx, rElbow, accentColor, 3);
      
    } else if (animationType === 'CRUNCH') {
      const hips = { x: 130, y: 195 };
      const knee = { x: 170, y: 160 };
      const foot = { x: 190, y: 195 };
      const shoulder = { x: 75 + phase * 26, y: 195 - phase * 32 };
      const neck = { x: shoulder.x + phase * 5, y: shoulder.y - 12 };
      const head = { x: neck.x - 2, y: neck.y - 14 };
      const elbow = { x: shoulder.x + 12, y: shoulder.y + 4 };
      const wrist = { x: shoulder.x + 4, y: shoulder.y + 12 };
      
      // Muscle highlight: Abs
      ctx.shadowBlur = 18;
      const abMidX = (hips.x + shoulder.x) / 2;
      const abMidY = (hips.y + shoulder.y) / 2;
      ctx.fillStyle = accentGlow;
      ctx.beginPath();
      ctx.arc(abMidX, abMidY, 9, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw skeleton
      ctx.shadowBlur = 10;
      drawSkeletonLine(ctx, foot, knee, 'rgba(255,255,255,0.2)', 2.5);
      drawBone(ctx, knee, hips, 'rgba(255,255,255,0.2)', 2.5);
      drawSkeletonLine(ctx, hips, shoulder, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, neck, accentColor, 3);
      drawSkeletonLine(ctx, shoulder, elbow, accentColor, 2);
      drawSkeletonLine(ctx, elbow, wrist, accentColor, 2);
      
      // Head
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.stroke();
      
      drawJointNode(ctx, hips, accentColor, 3.5);
      drawJointNode(ctx, shoulder, accentColor, 3.5);
    }
    
    activeAnimationId = requestAnimationFrame(draw);
  }
  
  activeAnimationId = requestAnimationFrame(draw);
}

// Draw skeletal line bone
function drawSkeletonLine(ctx, p1, p2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

// Draw skeleton joint node
function drawJointNode(ctx, p, color, radius) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
}

// Draw glowing targeted muscle capsule
function drawMuscleCapsule(ctx, p1, p2, radius, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}

// Saves a custom exercise added inside the Preset Builder modal
function savePresetCustomExercise() {
  const input = document.getElementById('preset-new-custom-ex-name');
  const catSelect = document.getElementById('preset-custom-ex-cat-select');
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
  renderPresetBuilderCatalogue();
  populateExerciseAutocomplete();
}

// Active Workout Session Reordering Implementation
function openActiveReorderModal() {
  if (!activeSession || !activeSession.exercises || activeSession.exercises.length === 0) {
    return;
  }
  // Deep copy the exercises so we can reorder them temporarily
  tempReorderExercises = activeSession.exercises.map(ex => ({
    name: ex.name,
    plannedSets: ex.plannedSets,
    actualSets: ex.actualSets ? [...ex.actualSets] : []
  }));
  
  document.getElementById('active-session-reorder-modal').classList.add('active');
  renderActiveReorderList();
}

function closeActiveReorderModal() {
  document.getElementById('active-session-reorder-modal').classList.remove('active');
}

function renderActiveReorderList() {
  const container = document.getElementById('active-reorder-list');
  if (!container) return;
  container.innerHTML = '';
  
  const currentIndex = activeSession.currentExerciseIndex;
  
  tempReorderExercises.forEach((ex, idx) => {
    const isCompleted = (idx < currentIndex);
    const isActive = (idx === currentIndex);
    const isUpcoming = (idx > currentIndex);
    
    // Create card container
    const item = document.createElement('div');
    item.className = 'reorder-item';
    item.dataset.reorderIdx = idx;
    item.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid ${isActive ? 'var(--accent-color)' : 'var(--card-border)'};
      padding: 12px 16px;
      border-radius: 12px;
      gap: 12px;
      opacity: ${isCompleted ? '0.45' : '1'};
      transition: border-color 0.25s ease, opacity 0.25s ease, box-shadow 0.25s ease;
      box-shadow: ${isActive ? '0 0 10px var(--accent-glow)' : 'none'};
      touch-action: none; /* Crucial for preventing scrolling during touch drags */
      user-select: none;
    `;
    
    // Left/Middle: Name & Status badge
    const infoCol = document.createElement('div');
    infoCol.style.cssText = 'display: flex; flex-direction: column; flex-grow: 1; min-width: 0;';
    
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-weight: 600; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);';
    nameSpan.textContent = ex.name;
    
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'reorder-badge';
    badgeSpan.style.cssText = 'font-size: 0.72rem; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;';
    
    if (isCompleted) {
      badgeSpan.style.color = 'var(--text-secondary)';
      badgeSpan.textContent = 'Completed';
    } else if (isActive) {
      badgeSpan.style.color = 'var(--accent-color)';
      badgeSpan.textContent = `Current Exercise • Set ${activeSession.currentSetIndex + 1} of ${ex.plannedSets}`;
    } else {
      badgeSpan.style.color = 'var(--text-secondary)';
      badgeSpan.textContent = 'Upcoming';
    }
    
    infoCol.appendChild(nameSpan);
    infoCol.appendChild(badgeSpan);
    item.appendChild(infoCol);
    
    // Right side: Drag handle (for movable items) or Checkmark (for completed items)
    if (!isCompleted) {
      const handle = document.createElement('div');
      handle.className = 'drag-handle';
      handle.style.cssText = `
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        padding: 8px;
        margin-right: -4px;
        flex-shrink: 0;
        user-select: none;
        touch-action: none;
      `;
      handle.innerHTML = `
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="2" y1="3" x2="16" y2="3" />
          <line x1="2" y1="9" x2="16" y2="9" />
        </svg>
      `;
      
      // Hook up Pointer Events for touch-compatible dragging
      handle.addEventListener('pointerdown', (e) => {
        onReorderDragStart(e, idx);
      });
      
      item.appendChild(handle);
    } else {
      // Completed items show a themed checkmark badge on the right
      const checkBadge = document.createElement('div');
      checkBadge.style.cssText = 'color: var(--accent-color); padding: 8px; opacity: 0.8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; filter: drop-shadow(0 0 5px var(--accent-glow));';
      checkBadge.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      `;
      item.appendChild(checkBadge);
    }
    
    container.appendChild(item);
  });
}

function onReorderDragStart(e, idx) {
  draggedIdx = idx;
  dragStartY = e.clientY;
  lastReorderPointerEvent = e;
  
  // Capture pointer events on the target element
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (err) {}
  
  const itemEl = document.querySelector(`[data-reorder-idx="${idx}"]`);
  if (itemEl) {
    itemEl.classList.add('dragging');
    itemEl.style.zIndex = '1000';
    itemEl.style.transform = 'scale(1.02)';
    itemEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    itemEl.style.borderColor = 'var(--accent-color)';
    itemEl.style.background = 'rgba(25, 27, 38, 0.95)';
    const handle = itemEl.querySelector('.drag-handle');
    if (handle) {
      handle.style.cursor = 'grabbing';
    }
  }
  
  // Register global drag listeners on window for drift tolerance & reliability
  window.addEventListener('pointermove', onReorderDragMove);
  window.addEventListener('pointerup', onReorderDragEnd);
  window.addEventListener('pointercancel', onReorderDragEnd);
  
  // Start the auto-scroll animation loop
  if (!reorderScrollAnimationFrame) {
    reorderScrollAnimationFrame = requestAnimationFrame(reorderScrollLoop);
  }
  
  e.preventDefault();
}

function onReorderDragMove(e) {
  if (draggedIdx === null) return;
  lastReorderPointerEvent = e;
  updateReorderDrag();
}

function reorderScrollLoop() {
  if (draggedIdx === null || !lastReorderPointerEvent) {
    reorderScrollAnimationFrame = null;
    return;
  }
  
  const e = lastReorderPointerEvent;
  const container = document.getElementById('active-reorder-list');
  if (container) {
    const rect = container.getBoundingClientRect();
    const pointerY = e.clientY;
    const threshold = 60; // px boundary zone at top/bottom of scroll container
    let scrollSpeed = 0;
    
    if (pointerY < rect.top + threshold) {
      // Near the top: scroll up (negative speed)
      const ratio = (rect.top + threshold - pointerY) / threshold;
      scrollSpeed = -Math.min(ratio, 2) * 5; // max speed 10px per frame
    } else if (pointerY > rect.bottom - threshold) {
      // Near the bottom: scroll down (positive speed)
      const ratio = (pointerY - (rect.bottom - threshold)) / threshold;
      scrollSpeed = Math.min(ratio, 2) * 5; // max speed 10px per frame
    }
    
    if (scrollSpeed !== 0) {
      const oldScrollTop = container.scrollTop;
      container.scrollTop += scrollSpeed;
      const actualScrollDiff = container.scrollTop - oldScrollTop;
      
      if (actualScrollDiff !== 0) {
        // Adjust the dragStartY by the scroll difference to keep target visual positioning in sync
        dragStartY -= actualScrollDiff;
        updateReorderDrag();
      }
    }
  }
  
  reorderScrollAnimationFrame = requestAnimationFrame(reorderScrollLoop);
}

function updateReorderDrag() {
  if (draggedIdx === null || !lastReorderPointerEvent) return;
  
  const e = lastReorderPointerEvent;
  const container = document.getElementById('active-reorder-list');
  if (!container) return;
  
  const rect = container.getBoundingClientRect();
  let currentY = e.clientY;
  
  // Constrain Y coordinate within container bounds to prevent dragging out of window
  if (currentY < rect.top) currentY = rect.top;
  if (currentY > rect.bottom) currentY = rect.bottom;
  
  const diffY = currentY - dragStartY;
  
  const itemEl = document.querySelector(`[data-reorder-idx="${draggedIdx}"]`);
  if (itemEl) {
    itemEl.style.transform = `translateY(${diffY}px) scale(1.02)`;
  }
  
  // Lock hit-testing center coordinate to container center to tolerate horizontal drift
  const testX = rect.left + rect.width / 2;
  
  // Find element under pointer, temporarily piercing through the dragging element
  if (itemEl) itemEl.style.pointerEvents = 'none';
  const elementUnder = document.elementFromPoint(testX, currentY);
  if (itemEl) itemEl.style.pointerEvents = 'auto';
  
  if (!elementUnder) return;
  
  // Find the closest reorder-item under the pointer
  const targetItem = elementUnder.closest('.reorder-item');
  if (targetItem && targetItem !== itemEl) {
    const targetIdx = parseInt(targetItem.dataset.reorderIdx);
    const currentIndex = activeSession.currentExerciseIndex;
    
    // Block swapping with completed items
    if (targetIdx < currentIndex || draggedIdx < currentIndex) {
      return;
    }
    
    // Calculate midpoint of the target item to prevent jittering
    const targetRect = targetItem.getBoundingClientRect();
    const targetMidpoint = targetRect.top + targetRect.height / 2;
    
    if (targetIdx > draggedIdx) {
      // Dragging down: only swap if pointer has passed the midpoint of target item
      if (currentY < targetMidpoint) return;
    } else {
      // Dragging up: only swap if pointer has passed the midpoint of target item
      if (currentY > targetMidpoint) return;
    }
    
    // FLIP Animation: Record current tops of all sibling elements before DOM change
    const parent = itemEl.parentNode;
    const siblings = Array.from(parent.children).filter(child => child !== itemEl);
    const firstPositions = siblings.map(sib => ({
      el: sib,
      top: sib.getBoundingClientRect().top
    }));
    
    // Record dragged item natural top before swap (subtracting current translation)
    const naturalTopBefore = itemEl.getBoundingClientRect().top - diffY;
    
    // Swap in temporary array
    const temp = tempReorderExercises[draggedIdx];
    tempReorderExercises[draggedIdx] = tempReorderExercises[targetIdx];
    tempReorderExercises[targetIdx] = temp;
    
    // Swap in the DOM
    if (targetIdx > draggedIdx) {
      parent.insertBefore(itemEl, targetItem.nextSibling);
    } else {
      parent.insertBefore(itemEl, targetItem);
    }
    
    // Re-acquire pointer focus since DOM insertion can release it
    if (e && e.target && e.pointerId !== undefined) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    
    // Update indices in the DOM
    Array.from(parent.children).forEach((child, index) => {
      child.dataset.reorderIdx = index;
    });
    
    // Calculate layout shift for the dragged item
    const naturalTopAfter = itemEl.getBoundingClientRect().top - diffY;
    const shift = naturalTopAfter - naturalTopBefore;
    
    // Adjust dragStartY by the exact layout shift to prevent visual cursor jumping!
    dragStartY += shift;
    draggedIdx = targetIdx;
    
    // Apply new translation instantly
    const newDiffY = currentY - dragStartY;
    itemEl.style.transform = `translateY(${newDiffY}px) scale(1.02)`;
    
    // FLIP Animation: Invert sibling positions and transition smoothly
    firstPositions.forEach(pos => {
      const lastTop = pos.el.getBoundingClientRect().top;
      const invertY = pos.top - lastTop;
      
      if (invertY !== 0) {
        // Invert: shift sibling back to its original visual position instantly
        pos.el.style.transition = 'none';
        pos.el.style.transform = `translateY(${invertY}px)`;
        
        // Force browser layout recalculation
        pos.el.offsetHeight;
        
        // Play: animate back to its new natural DOM position (translateY(0))
        pos.el.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        pos.el.style.transform = 'translateY(0)';
      }
    });
    
    updateReorderBadgesAndStyles();
  }
}

function onReorderDragEnd(e) {
  if (draggedIdx === null) return;
  
  // Clean up global listeners
  window.removeEventListener('pointermove', onReorderDragMove);
  window.removeEventListener('pointerup', onReorderDragEnd);
  window.removeEventListener('pointercancel', onReorderDragEnd);
  
  // Cancel auto-scroll loop
  if (reorderScrollAnimationFrame) {
    cancelAnimationFrame(reorderScrollAnimationFrame);
    reorderScrollAnimationFrame = null;
  }
  lastReorderPointerEvent = null;
  
  if (e && e.target) {
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }
  
  const itemEl = document.querySelector(`[data-reorder-idx="${draggedIdx}"]`);
  if (itemEl) {
    itemEl.classList.remove('dragging');
    itemEl.style.zIndex = '';
    itemEl.style.transform = '';
    itemEl.style.boxShadow = '';
    itemEl.style.borderColor = '';
    itemEl.style.background = '';
    const handle = itemEl.querySelector('.drag-handle');
    if (handle) {
      handle.style.cursor = '';
    }
  }
  
  draggedIdx = null;
  
  // Complete visual redraw
  renderActiveReorderList();
}

function updateReorderBadgesAndStyles() {
  const currentIndex = activeSession.currentExerciseIndex;
  const items = document.querySelectorAll('#active-reorder-list .reorder-item');
  
  items.forEach(item => {
    const idx = parseInt(item.dataset.reorderIdx);
    const isCompleted = (idx < currentIndex);
    const isActive = (idx === currentIndex);
    
    // Update active highlight styling on the fly (but leave dragging item's styles alone)
    if (!item.classList.contains('dragging')) {
      item.style.borderColor = isActive ? 'var(--accent-color)' : 'var(--card-border)';
      item.style.boxShadow = isActive ? '0 0 10px var(--accent-glow)' : 'none';
    }
    
    const badgeSpan = item.querySelector('.reorder-badge');
    if (badgeSpan) {
      const ex = tempReorderExercises[idx];
      if (isCompleted) {
        badgeSpan.style.color = 'var(--text-secondary)';
        badgeSpan.textContent = 'Completed';
      } else if (isActive) {
        badgeSpan.style.color = 'var(--accent-color)';
        badgeSpan.textContent = `Current Exercise • Set ${activeSession.currentSetIndex + 1} of ${ex.plannedSets}`;
      } else {
        badgeSpan.style.color = 'var(--text-secondary)';
        badgeSpan.textContent = 'Upcoming';
      }
    }
  });
}

function saveActiveReorderChanges() {
  const originalActiveEx = activeSession.exercises[activeSession.currentExerciseIndex];
  const newActiveEx = tempReorderExercises[activeSession.currentExerciseIndex];
  
  const activeExChanged = (originalActiveEx.name !== newActiveEx.name);
  
  // Commit the new order to the session
  activeSession.exercises = tempReorderExercises;
  
  if (activeExChanged) {
    // Reset set counter to the new active exercise's completed sets count
    activeSession.currentSetIndex = newActiveEx.actualSets ? newActiveEx.actualSets.length : 0;
    
    // Clear rest timer if running
    clearInterval(activeSession.timerInterval);
    if (restAudio) {
      restAudio.pause();
      restAudio.onended = null;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('pause', null);
    }
    
    // Switch UI focus to the new exercise
    startActiveExerciseTracking();
  } else {
    // If active exercise is the same but upcoming exercises were reordered,
    // and we are currently on the rest timer screen:
    const timerScreen = document.getElementById('screen-track-timer');
    if (timerScreen && timerScreen.classList.contains('active')) {
      const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
      const isLastSetOfExercise = (activeSession.currentSetIndex === currentEx.plannedSets - 1);
      if (isLastSetOfExercise && activeSession.currentExerciseIndex < activeSession.exercises.length - 1) {
        const nextEx = activeSession.exercises[activeSession.currentExerciseIndex + 1];
        const subtext = document.getElementById('timer-next-set');
        if (subtext) {
          subtext.textContent = `Up Next: ${nextEx.name} (Set 1 of ${nextEx.plannedSets})`;
        }
      }
    }
    
    // Also, if we are on the wait reps screen, update exercise details just in case
    const waitRepsScreen = document.getElementById('screen-track-wait-reps');
    if (waitRepsScreen && waitRepsScreen.classList.contains('active')) {
      const currentEx = activeSession.exercises[activeSession.currentExerciseIndex];
      document.getElementById('active-ex-name').textContent = currentEx.name;
      document.getElementById('active-set-count').textContent = `Set ${activeSession.currentSetIndex + 1} of ${currentEx.plannedSets}`;
    }
  }
  
  closeActiveReorderModal();
}


