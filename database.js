// ========================================
// DATABASE.JS - Gestion du stockage IndexedDB
// Permet de stocker plus de données que localStorage
// ========================================

class JiramaDatabase {
    constructor() {
        this.dbName = 'JiramaDB';
        this.dbVersion = 2;  // Version 2 pour ajouter les nouvelles tables
        this.db = null;
    }

    // Ouvrir la base de données
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('❌ Erreur ouverture DB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Base de données IndexedDB ouverte');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('🔧 Mise à jour de la structure de la base de données');
                
                // Table persons
                if (!db.objectStoreNames.contains('persons')) {
                    const personStore = db.createObjectStore('persons', { keyPath: 'id' });
                    personStore.createIndex('name', 'name');
                    personStore.createIndex('email', 'email');
                    console.log('✅ Table "persons" créée');
                }
                
                // Table appliances
                if (!db.objectStoreNames.contains('appliances')) {
                    const applianceStore = db.createObjectStore('appliances', { keyPath: 'id' });
                    applianceStore.createIndex('personId', 'personId');
                    applianceStore.createIndex('type', 'type');
                    console.log('✅ Table "appliances" créée');
                }
                
                // Table history
                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('date', 'date');
                    historyStore.createIndex('period', 'period');
                    console.log('✅ Table "history" créée');
                }
                
                // Table commonExpenses
                if (!db.objectStoreNames.contains('commonExpenses')) {
                    const expensesStore = db.createObjectStore('commonExpenses', { keyPath: 'id' });
                    expensesStore.createIndex('date', 'date');
                    console.log('✅ Table "commonExpenses" créée');
                }
                
                // Table settings
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                    console.log('✅ Table "settings" créée');
                }
            };
        });
    }
    
    // ========================================
    // FONCTIONS CRUD (Create, Read, Update, Delete)
    // ========================================
    
    // Ajouter ou mettre à jour une donnée
    async save(storeName, data) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => {
                console.log(`✅ Donnée sauvegardée dans ${storeName}`);
                resolve(request.result);
            };
            
            request.onerror = () => {
                console.error(`❌ Erreur sauvegarde dans ${storeName}:`, request.error);
                reject(request.error);
            };
        });
    }
    
    // Récupérer toutes les données d'une table
    async getAll(storeName) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                console.error(`❌ Erreur lecture de ${storeName}:`, request.error);
                reject(request.error);
            };
        });
    }
    
    // Récupérer une donnée par son ID
    async getById(storeName, id) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Supprimer une donnée par son ID
    async delete(storeName, id) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => {
                console.log(`✅ Donnée supprimée de ${storeName}`);
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // Supprimer toutes les données d'une table
    async clear(storeName) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log(`✅ Table ${storeName} vidée`);
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // ========================================
    // FONCTIONS DE RECHERCHE SPÉCIFIQUES
    // ========================================
    
    // Rechercher des personnes par nom
    async findPersonsByName(name) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['persons'], 'readonly');
            const store = transaction.objectStore('persons');
            const index = store.index('name');
            const range = IDBKeyRange.only(name);
            const request = index.getAll(range);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Rechercher des appareils par personne
    async findAppliancesByPerson(personId) {
        if (!this.db) await this.open();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['appliances'], 'readonly');
            const store = transaction.objectStore('appliances');
            const index = store.index('personId');
            const request = index.getAll(personId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // ========================================
    // FONCTIONS DE SAUVEGARDE/RESTAURATION
    // ========================================
    
    // Sauvegarder toutes les données en une fois
    async saveAllData(data) {
        const stores = ['persons', 'appliances', 'history', 'commonExpenses', 'settings'];
        
        for (const store of stores) {
            if (data[store] && data[store].length) {
                await this.clear(store);
                for (const item of data[store]) {
                    await this.save(store, item);
                }
            }
        }
        
        console.log('✅ Toutes les données sauvegardées');
    }
    
    // Récupérer toutes les données
    async getAllData() {
        const data = {};
        const stores = ['persons', 'appliances', 'history', 'commonExpenses'];
        
        for (const store of stores) {
            data[store] = await this.getAll(store);
        }
        
        return data;
    }
    
    // ========================================
    // EXPORTER LES DONNÉES
    // ========================================
    
    async exportToJSON() {
        const data = await this.getAllData();
        return JSON.stringify(data, null, 2);
    }
    
    async importFromJSON(jsonString) {
        const data = JSON.parse(jsonString);
        await this.saveAllData(data);
        console.log('✅ Import réussi');
    }
}

// Créer une instance unique
const db = new JiramaDatabase();

// Initialiser la base de données au chargement
async function initDatabase() {
    await db.open();
    
    // Vérifier si des données existent déjà
    const persons = await db.getAll('persons');
    
    if (persons.length === 0 && window.persons && window.persons.length > 0) {
        // Migrer les données de localStorage vers IndexedDB
        console.log('🔄 Migration des données vers IndexedDB...');
        
        for (const person of window.persons) {
            await db.save('persons', person);
        }
        
        for (const appliance of window.appliances) {
            await db.save('appliances', appliance);
        }
        
        for (const history of window.history) {
            await db.save('history', history);
        }
        
        if (window.commonExpenses) {
            for (const expense of window.commonExpenses) {
                await db.save('commonExpenses', expense);
            }
        }
        
        console.log('✅ Migration terminée');
    }
}

// Exporter pour utilisation dans style.js
window.db = db;
window.initDatabase = initDatabase;
