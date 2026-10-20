// ===== Main Application =====
let currentScreen = 'home';
let allRecipes = [];
let allCategories = [];
let currentFilter = 'all';
let autoSuggestCategory = true;

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    await seedDefaultCategories();
    autoSuggestCategory = await getSetting('autoSuggestCategory', true);
    
    setupNavigation();
    setupSettingsButton();
    await showScreen('home');
    
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
  } catch (err) {
    console.error('Failed to initialize app:', err);
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state">
        <div class="emoji">⚠️</div>
        <p>שגיאה בטעינת האפליקציה</p>
        <p class="text-muted">${err.message}</p>
      </div>
    `;
  }
});

// ===== Navigation =====
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      showScreen(screen);
    });
  });
}

function setupSettingsButton() {
  document.getElementById('btn-settings').addEventListener('click', () => {
    showScreen('settings');
  });
}

async function showScreen(screenName) {
  currentScreen = screenName;
  
  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenName);
  });
  
  // Update title
  const titles = {
    home: 'המתכונים שלי',
    import: 'ייבוא מתכון',
    categories: 'קטגוריות',
    settings: 'הגדרות',
    detail: 'פרטי מתכון'
  };
  document.getElementById('page-title').textContent = titles[screenName] || 'המתכונים שלי';
  
  // Render screen
  const main = document.getElementById('main-content');
  
  switch (screenName) {
    case 'home':
      await renderHomeScreen(main);
      break;
    case 'import':
      renderImportScreen(main);
      break;
    case 'categories':
      await renderCategoriesScreen(main);
      break;
    case 'settings':
      await renderSettingsScreen(main);
      break;
    default:
      main.innerHTML = '<p>מסך לא נמצא</p>';
  }
}

// ===== Home Screen =====
async function renderHomeScreen(container) {
  allRecipes = await getAllRecipes();
  allCategories = await getAllCategories();
  
  const categoryMap = {};
  allCategories.forEach(c => categoryMap[c.id] = c.name);
  
  let filtered = allRecipes;
  if (currentFilter !== 'all') {
    filtered = allRecipes.filter(r => r.categoryId == currentFilter);
  }
  
  container.innerHTML = `
    <div class="search-bar">
      <input type="search" id="search-input" class="input" placeholder="חיפוש מתכון...">
    </div>
    
    <div class="filter-row" id="filter-row">
      <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">הכל</button>
      ${allCategories.map(c => `
        <button class="filter-chip ${currentFilter == c.id ? 'active' : ''}" data-filter="${c.id}">${c.name}</button>
      `).join('')}
    </div>
    
    <div class="recipe-list" id="recipe-list">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="emoji">📝</div>
          <p>עדיין אין מתכונים</p>
          <p class="text-muted">לחץ על "ייבוא" כדי להוסיף את המתכון הראשון</p>
        </div>
      ` : filtered.map(r => `
        <div class="recipe-item" data-id="${r.id}">
          <div>
            <div class="recipe-item-title">${escapeHtml(r.title)}</div>
            <div class="recipe-item-category">${categoryMap[r.categoryId] || 'ללא קטגוריה'}</div>
          </div>
          <span>›</span>
        </div>
      `).join('')}
    </div>
  `;
  
  // Filter chips
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentFilter = chip.dataset.filter;
      renderHomeScreen(container);
    });
  });
  
  // Search
  const searchInput = container.querySelector('#search-input');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const list = container.querySelector('#recipe-list');
    const items = filtered.filter(r => r.title.toLowerCase().includes(q));
    
    list.innerHTML = items.length === 0 ? `
      <div class="empty-state"><p>לא נמצאו תוצאות</p></div>
    ` : items.map(r => `
      <div class="recipe-item" data-id="${r.id}">
        <div>
          <div class="recipe-item-title">${escapeHtml(r.title)}</div>
          <div class="recipe-item-category">${categoryMap[r.categoryId] || 'ללא קטגוריה'}</div>
        </div>
        <span>›</span>
      </div>
    `).join('');
    
    attachRecipeClickHandlers(list);
  });
  
  attachRecipeClickHandlers(container.querySelector('#recipe-list'));
}

function attachRecipeClickHandlers(listEl) {
  listEl.querySelectorAll('.recipe-item').forEach(item => {
    item.addEventListener('click', () => showRecipeDetail(item.dataset.id));
  });
}

// ===== Recipe Detail =====
async function showRecipeDetail(id) {
  const recipe = await getRecipeById(id);
  if (!recipe) return;
  
  allCategories = await getAllCategories();
  const category = allCategories.find(c => c.id === recipe.categoryId);
  
  currentScreen = 'detail';
  document.getElementById('page-title').textContent = 'פרטי מתכון';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="recipe-detail">
      <h2>${escapeHtml(recipe.title)}</h2>
      <div class="recipe-meta">
        קטגוריה: ${category ? category.name : 'ללא'} 
        ${recipe.sourceUrl ? `· <a href="${recipe.sourceUrl}" target="_blank">מקור</a>` : ''}
      </div>
      
      <div class="recipe-section">
        <h3>מרכיבים</h3>
        <div>${formatMultiline(recipe.ingredients)}</div>
      </div>
      
      <div class="recipe-section">
        <h3>אופן ההכנה</h3>
        <div>${formatMultiline(recipe.instructions)}</div>
      </div>
      
      <div class="action-bar">
        <button class="btn btn-secondary" id="btn-edit">עריכה</button>
        <button class="btn btn-danger" id="btn-delete">מחיקה</button>
      </div>
      <button class="btn btn-secondary mt-3" id="btn-back" style="width:100%">חזרה</button>
    </div>
  `;
  
  main.querySelector('#btn-back').addEventListener('click', () => showScreen('home'));
  main.querySelector('#btn-delete').addEventListener('click', async () => {
    if (confirm('למחוק את המתכון?')) {
      await deleteRecipe(id);
      showScreen('home');
    }
  });
  main.querySelector('#btn-edit').addEventListener('click', () => showEditRecipe(recipe));
}

// ===== Edit Recipe =====
async function showEditRecipe(recipe) {
  allCategories = await getAllCategories();
  
  const main = document.getElementById('main-content');
  document.getElementById('page-title').textContent = 'עריכת מתכון';
  
  main.innerHTML = `
    <div class="import-form">
      <label class="label">שם המתכון</label>
      <input type="text" id="edit-title" class="input" value="${escapeHtml(recipe.title)}">
      
      <label class="label">קטגוריה</label>
      <select id="edit-category" class="select">
        ${allCategories.map(c => `
          <option value="${c.id}" ${c.id === recipe.categoryId ? 'selected' : ''}>${c.name}</option>
        `).join('')}
      </select>
      
      <label class="label">מרכיבים</label>
      <textarea id="edit-ingredients" class="textarea">${escapeHtml(recipe.ingredients || '')}</textarea>
      
      <label class="label">אופן ההכנה</label>
      <textarea id="edit-instructions" class="textarea">${escapeHtml(recipe.instructions || '')}</textarea>
      
      <button class="btn btn-primary" id="btn-save-edit">שמור שינויים</button>
      <button class="btn btn-secondary mt-2" id="btn-cancel-edit" style="width:100%">ביטול</button>
    </div>
  `;
  
  main.querySelector('#btn-cancel-edit').addEventListener('click', () => showRecipeDetail(recipe.id));
  main.querySelector('#btn-save-edit').addEventListener('click', async () => {
    const updates = {
      title: main.querySelector('#edit-title').value.trim(),
      categoryId: Number(main.querySelector('#edit-category').value),
      ingredients: main.querySelector('#edit-ingredients').value.trim(),
      instructions: main.querySelector('#edit-instructions').value.trim()
    };
    if (!updates.title) return alert('יש להזין שם למתכון');
    await updateRecipe(recipe.id, updates);
    showRecipeDetail(recipe.id);
  });
}
// ===== Import Screen =====
function renderImportScreen(container) {
  container.innerHTML = `
    <div class="import-form">
      <div class="filter-row" style="margin-bottom:16px;">
        <button class="filter-chip active" id="tab-link" data-tab="link">קישור</button>
        <button class="filter-chip" id="tab-text" data-tab="text">הדבק טקסט</button>
      </div>

      <div id="panel-link">
        <label class="label">הדבק קישור למתכון</label>
        <input type="url" id="import-url" class="input" placeholder="https://...">
        <button class="btn btn-primary" id="btn-import-link">ייבא מקישור</button>
        <p class="text-muted text-center mt-2" style="font-size:0.8rem;">
          הקישור נשמר כמקור. התוכן עדיין צריך להידבק ידנית.
        </p>
      </div>

      <div id="panel-text" class="hidden">
        <label class="label">הדבק את כל טקסט המתכון</label>
        <textarea id="import-text" class="textarea" style="min-height:180px;" placeholder="הדבק כאן את שם המתכון, המרכיבים ואופן ההכנה..."></textarea>
        <button class="btn btn-primary" id="btn-import-text">נתח ושמור</button>
        <p class="text-muted text-center mt-2" style="font-size:0.8rem;">
          המערכת תנסה לפצל אוטומטית למרכיבים והוראות.
        </p>
      </div>
      
      <div id="import-result" class="import-result hidden"></div>
    </div>
  `;
  
  // Tab switching
  const tabLink = container.querySelector('#tab-link');
  const tabText = container.querySelector('#tab-text');
  const panelLink = container.querySelector('#panel-link');
  const panelText = container.querySelector('#panel-text');

  tabLink.addEventListener('click', () => {
    tabLink.classList.add('active');
    tabText.classList.remove('active');
    panelLink.classList.remove('hidden');
    panelText.classList.add('hidden');
  });
  tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabLink.classList.remove('active');
    panelText.classList.remove('hidden');
    panelLink.classList.add('hidden');
  });

  container.querySelector('#btn-import-link').addEventListener('click', handleImport);
  container.querySelector('#btn-import-text').addEventListener('click', handleTextImport);
}

async function handleImport() {
  const urlInput = document.getElementById('import-url');
  const url = urlInput.value.trim();
  if (!url) return alert('יש להדביק קישור');
  
  const resultDiv = document.getElementById('import-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = '<p class="text-center">מייבא...</p>';
  
  try {
    const title = extractTitleFromUrl(url);
    const suggestedCategoryId = await suggestCategory(title);
    await showImportResult({ title, ingredients: '', instructions: '', sourceUrl: url, suggestedCategoryId });
  } catch (err) {
    resultDiv.innerHTML = `<p class="text-center" style="color:var(--danger)">שגיאה: ${err.message}</p>`;
  }
}

async function handleTextImport() {
  const textArea = document.getElementById('import-text');
  const raw = textArea.value.trim();
  if (!raw) return alert('יש להדביק טקסט של מתכון');

  const resultDiv = document.getElementById('import-result');
  resultDiv.classList.remove('hidden');
  resultDiv.innerHTML = '<p class="text-center">מנתח...</p>';

  try {
    const parsed = parseRecipeText(raw);
    const suggestedCategoryId = await suggestCategory(parsed.title);
    await showImportResult({
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
      sourceUrl: '',
      suggestedCategoryId
    });
  } catch (err) {
    resultDiv.innerHTML = `<p class="text-center" style="color:var(--danger)">שגיאה: ${err.message}</p>`;
  }
}

async function showImportResult({ title, ingredients, instructions, sourceUrl, suggestedCategoryId }) {
  const resultDiv = document.getElementById('import-result');
  allCategories = await getAllCategories();

  resultDiv.innerHTML = `
    <div class="card">
      <h3>תוצאת הייבוא</h3>
      
      <label class="label">שם המתכון</label>
      <input type="text" id="result-title" class="input" value="${escapeHtml(title)}">
      
      <label class="label">קטגוריה</label>
      <select id="result-category" class="select">
        ${allCategories.map(c => `
          <option value="${c.id}" ${c.id === suggestedCategoryId ? 'selected' : ''}>${c.name}</option>
        `).join('')}
      </select>
      
      <label class="label">מרכיבים</label>
      <textarea id="result-ingredients" class="textarea">${escapeHtml(ingredients)}</textarea>
      
      <label class="label">אופן ההכנה</label>
      <textarea id="result-instructions" class="textarea">${escapeHtml(instructions)}</textarea>
      
      <button class="btn btn-primary mt-2" id="btn-save-recipe">שמור מתכון</button>
    </div>
  `;
  
  document.getElementById('btn-save-recipe').addEventListener('click', async () => {
    const recipe = {
      title: document.getElementById('result-title').value.trim(),
      categoryId: Number(document.getElementById('result-category').value),
      ingredients: document.getElementById('result-ingredients').value.trim(),
      instructions: document.getElementById('result-instructions').value.trim(),
      sourceUrl: sourceUrl || ''
    };
    
    if (!recipe.title) return alert('יש להזין שם למתכון');
    
    await addRecipe(recipe);
    alert('המתכון נשמר בהצלחה!');
    document.getElementById('import-url').value = '';
    document.getElementById('import-text').value = '';
    resultDiv.classList.add('hidden');
    showScreen('home');
  });
}

/** Simple heuristic parser for pasted recipe text */
function parseRecipeText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { title: 'מתכון חדש', ingredients: '', instructions: '' };
  }

  // First non-empty line is usually the title
  let title = lines[0];
  // Clean common prefixes
  title = title.replace(/^(מתכון ל|מתכון:|שם המתכון:)\s*/i, '').trim();

  const ingredientKeywords = /מרכיבים|מצרכים|רכיבים|ingredients|what you'll need/i;
  const instructionKeywords = /אופן ההכנה|הכנה|הוראות|שיטה|instructions|directions|method|steps/i;

  let ingredientsStart = -1;
  let instructionsStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (ingredientsStart === -1 && ingredientKeywords.test(lines[i])) {
      ingredientsStart = i;
    }
    if (instructionsStart === -1 && instructionKeywords.test(lines[i])) {
      instructionsStart = i;
    }
  }

  let ingredients = '';
  let instructions = '';

  if (ingredientsStart !== -1 && instructionsStart !== -1) {
    // Both sections found
    const startIng = ingredientsStart + 1;
    const endIng = instructionsStart;
    ingredients = lines.slice(startIng, endIng).join('\n');
    instructions = lines.slice(instructionsStart + 1).join('\n');
  } else if (ingredientsStart !== -1) {
    ingredients = lines.slice(ingredientsStart + 1).join('\n');
  } else if (instructionsStart !== -1) {
    // Assume everything before instructions is ingredients (except title)
    ingredients = lines.slice(1, instructionsStart).join('\n');
    instructions = lines.slice(instructionsStart + 1).join('\n');
  } else {
    // No clear headers – try to split by looking for numbered steps
    const numbered = lines.findIndex((l, idx) => idx > 0 && /^\d+[\.\)]\s/.test(l));
    if (numbered > 1) {
      ingredients = lines.slice(1, numbered).join('\n');
      instructions = lines.slice(numbered).join('\n');
    } else {
      // Fallback: everything after title goes to ingredients
      ingredients = lines.slice(1).join('\n');
    }
  }

  return {
    title: title || 'מתכון חדש',
    ingredients: ingredients.trim(),
    instructions: instructions.trim()
  };
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    // Try to get a readable title from path
    const path = u.pathname.split('/').filter(Boolean).pop() || '';
    const title = decodeURIComponent(path)
      .replace(/[-_]/g, ' ')
      .replace(/\.\w+$/, '')
      .trim();
    return title || 'מתכון חדש';
  } catch {
    return 'מתכון חדש';
  }
}

async function suggestCategory(title) {
  if (!autoSuggestCategory) return null;
  
  const categories = await getAllCategories();
  const lower = title.toLowerCase();
  
  const keywords = {
    'קינוחים': ['עוגה', 'עוגיות', 'קינוח', 'שוקולד', 'גלידה', 'פאי', 'מאפה', 'cake', 'cookie', 'dessert'],
    'מרקים': ['מרק', 'soup'],
    'סלטים': ['סלט', 'salad'],
    'מהיר': ['מהיר', 'quick', '15 דקות', '20 דקות'],
    'עיקריות': ['עוף', 'בשר', 'דג', 'פסטה', 'אורז', 'chicken', 'beef', 'fish', 'pasta']
  };
  
  for (const [catName, words] of Object.entries(keywords)) {
    if (words.some(w => lower.includes(w))) {
      const found = categories.find(c => c.name === catName);
      if (found) return found.id;
    }
  }
  
  // Default to "אחר" or first category
  const other = categories.find(c => c.name === 'אחר');
  return other ? other.id : (categories[0]?.id || null);
}

// ===== Categories Screen =====
async function renderCategoriesScreen(container) {
  allCategories = await getAllCategories();
  
  container.innerHTML = `
    <div class="card">
      <label class="label">קטגוריה חדשה</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="new-category-name" class="input" placeholder="שם הקטגוריה" style="margin-bottom:0; flex:1;">
        <button class="btn btn-primary" id="btn-add-category" style="width:auto; padding:12px 16px;">הוסף</button>
      </div>
    </div>
    
    <div id="categories-list">
      ${allCategories.length === 0 ? `
        <div class="empty-state"><p>אין קטגוריות עדיין</p></div>
      ` : allCategories.map(c => `
        <div class="category-item" data-id="${c.id}">
          <span>${escapeHtml(c.name)}</span>
          <div class="category-actions">
            <button class="btn-edit-cat" title="עריכה">✏️</button>
            <button class="btn-delete-cat" title="מחיקה">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  container.querySelector('#btn-add-category').addEventListener('click', async () => {
    const input = container.querySelector('#new-category-name');
    const name = input.value.trim();
    if (!name) return alert('יש להזין שם');
    try {
      await addCategory(name);
      input.value = '';
      renderCategoriesScreen(container);
    } catch (err) {
      alert('שגיאה: ייתכן שהשם כבר קיים');
    }
  });
  
  container.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.category-item');
      const id = Number(item.dataset.id);
      const currentName = item.querySelector('span').textContent;
      const newName = prompt('שם חדש לקטגוריה:', currentName);
      if (newName && newName.trim()) {
        await updateCategory(id, newName.trim());
        renderCategoriesScreen(container);
      }
    });
  });
  
  container.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.category-item');
      const id = Number(item.dataset.id);
      if (confirm('למחוק את הקטגוריה? מתכונים קיימים לא יימחקו.')) {
        await deleteCategory(id);
        renderCategoriesScreen(container);
      }
    });
  });
}

// ===== Settings Screen =====
async function renderSettingsScreen(container) {
  autoSuggestCategory = await getSetting('autoSuggestCategory', true);
  
  container.innerHTML = `
    <div class="settings-item">
      <div>
        <strong>הצע קטגוריה אוטומטית</strong>
        <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">
          בעת ייבוא מתכון תוצע קטגוריה לפי שם המתכון
        </p>
      </div>
      <label class="toggle">
        <input type="checkbox" id="toggle-auto-suggest" ${autoSuggestCategory ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <div class="card mt-3">
      <p class="text-muted" style="font-size:0.9rem; line-height:1.6;">
        <strong>גרסה 1.0 – שלד ראשוני</strong><br>
        ייבוא דרך קישור + ארגון לפי קטגוריות.<br>
        בהמשך יתווספו: פירוק AI חכם, רשימת קניות, עוזר בישול ועוד.
      </p>
    </div>
    
    <button class="btn btn-secondary mt-3" id="btn-back-settings" style="width:100%">חזרה</button>
  `;
  
  container.querySelector('#toggle-auto-suggest').addEventListener('change', async (e) => {
    autoSuggestCategory = e.target.checked;
    await setSetting('autoSuggestCategory', autoSuggestCategory);
  });
  
  container.querySelector('#btn-back-settings').addEventListener('click', () => showScreen('home'));
}

// ===== Helpers =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMultiline(text) {
  if (!text) return '<p class="text-muted">לא הוזן</p>';
  return text.split('\n').filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('');
}
