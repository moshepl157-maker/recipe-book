// ===== IndexedDB Database Layer =====
const DB_NAME = 'RecipeBookDB';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize the database
 */
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Categories store
      if (!database.objectStoreNames.contains('categories')) {
        const catStore = database.createObjectStore('categories', {
          keyPath: 'id',
          autoIncrement: true
        });
        catStore.createIndex('name', 'name', { unique: true });
      }

      // Recipes store
      if (!database.objectStoreNames.contains('recipes')) {
        const recipeStore = database.createObjectStore('recipes', {
          keyPath: 'id',
          autoIncrement: true
        });
        recipeStore.createIndex('categoryId', 'categoryId', { unique: false });
        recipeStore.createIndex('title', 'title', { unique: false });
        recipeStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

// ===== Categories =====
async function getAllCategories() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function addCategory(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const category = {
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    const request = store.add(category);
    request.onsuccess = () => resolve({ id: request.result, ...category });
    request.onerror = () => reject(request.error);
  });
}

async function updateCategory(id, name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const category = getReq.result;
      if (!category) return reject(new Error('Category not found'));
      category.name = name.trim();
      const putReq = store.put(category);
      putReq.onsuccess = () => resolve(category);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteCategory(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== Recipes =====
async function getAllRecipes() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readonly');
    const store = tx.objectStore('recipes');
    const request = store.getAll();
    request.onsuccess = () => {
      const recipes = request.result || [];
      // Sort by createdAt descending (newest first)
      recipes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(recipes);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getRecipeById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readonly');
    const store = tx.objectStore('recipes');
    const request = store.get(Number(id));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addRecipe(recipe) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readwrite');
    const store = tx.objectStore('recipes');
    const newRecipe = {
      ...recipe,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const request = store.add(newRecipe);
    request.onsuccess = () => resolve({ id: request.result, ...newRecipe });
    request.onerror = () => reject(request.error);
  });
}

async function updateRecipe(id, updates) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readwrite');
    const store = tx.objectStore('recipes');
    const getReq = store.get(Number(id));
    getReq.onsuccess = () => {
      const recipe = getReq.result;
      if (!recipe) return reject(new Error('Recipe not found'));
      const updated = {
        ...recipe,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function deleteRecipe(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes', 'readwrite');
    const store = tx.objectStore('recipes');
    const request = store.delete(Number(id));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== Settings =====
async function getSetting(key, defaultValue = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(key);
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : defaultValue);
    };
    request.onerror = () => reject(request.error);
  });
}

async function setSetting(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== Seed default categories =====
async function seedDefaultCategories() {
  const existing = await getAllCategories();
  if (existing.length === 0) {
    const defaults = ['עיקריות', 'קינוחים', 'מרקים', 'סלטים', 'מהיר', 'אחר'];
    for (const name of defaults) {
      await addCategory(name);
    }
  }
}
