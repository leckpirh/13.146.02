// ========================================
// CLOUD-STORAGE.JS - Sauvegarde par compte utilisateur
// ========================================

class CloudStorage {
    constructor() {
        this.gapiInitialized = false;
        this.tokenClient = null;
        this.accessToken = null;
        this.currentUser = null;
        this.isSignedIn = false;
    }

    // ========================================
    // INITIALISATION
    // ========================================
    
    async init() {
        console.log('☁️ Initialisation Cloud Storage...');
        
        // Charger l'utilisateur sauvegardé
        const savedUser = localStorage.getItem('cloudUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.isSignedIn = true;
            console.log(`✅ Utilisateur connecté: ${this.currentUser.email}`);
        }
        
        // Initialiser Google API
        await this.initGoogleAPI();
        
        return this.isSignedIn;
    }
    
    async initGoogleAPI() {
        return new Promise((resolve) => {
            if (typeof gapi === 'undefined') {
                console.log('⏳ Attente chargement Google API...');
                setTimeout(() => this.initGoogleAPI().then(resolve), 500);
                return;
            }
            
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: 'AIzaSyBtD4STn8dJAbfvmeJxsZuU4R4cMUPsow8',
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    
                    console.log('✅ Google API initialisé');
                    this.gapiInitialized = true;
                    resolve(true);
                } catch (error) {
                    console.error('❌ Erreur init Google API:', error);
                    resolve(false);
                }
            });
        });
    }
    
    // ========================================
    // AUTHENTIFICATION
    // ========================================
    
    // Configurer le token client OAuth
    setupTokenClient() {
        if (typeof google === 'undefined' || !google.accounts) {
            console.error('❌ Google Accounts non disponible');
            return false;
        }
        
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '108986838801937638933',
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
            callback: (tokenResponse) => {
                this.accessToken = tokenResponse.access_token;
                this.isSignedIn = true;
                
                // Récupérer les infos utilisateur
                this.getUserInfo();
                
                console.log('✅ Authentification Google Drive réussie');
                showNotification('Connecté à Google Drive avec succès', 'success');
                
                // Mettre à jour l'interface
                this.updateUIAfterLogin();
            },
        });
        
        return true;
    }
    
    // Se connecter avec Google
    async signIn() {
        if (!this.gapiInitialized) {
            await this.initGoogleAPI();
        }
        
        if (!this.tokenClient) {
            this.setupTokenClient();
        }
        
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken();
        } else {
            showNotification('Impossible de se connecter à Google', 'error');
        }
    }
    
    // Se déconnecter
    signOut() {
        this.accessToken = null;
        this.isSignedIn = false;
        this.currentUser = null;
        localStorage.removeItem('cloudUser');
        
        showNotification('Déconnecté de Google Drive', 'info');
        this.updateUIAfterLogout();
    }
    
    // Récupérer les infos utilisateur
    async getUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const userInfo = await response.json();
            
            this.currentUser = {
                id: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
            };
            
            localStorage.setItem('cloudUser', JSON.stringify(this.currentUser));
            console.log(`✅ Utilisateur: ${this.currentUser.name} (${this.currentUser.email})`);
            
            // Mettre à jour l'affichage
            this.displayUserInfo();
            
        } catch (error) {
            console.error('❌ Erreur récupération infos utilisateur:', error);
        }
    }
    
    // ========================================
    // SAUVEGARDE ET RESTAURATION
    // ========================================
    
    // Sauvegarder les données dans Google Drive
    async saveData(data) {
        if (!this.isSignedIn || !this.accessToken) {
            showNotification('Veuillez vous connecter à Google Drive d\'abord', 'info');
            await this.signIn();
            return false;
        }
        
        showNotification('Sauvegarde en cours...', 'info');
        
        const fileName = `jirama_backup_${new Date().toISOString().split('T')[0]}.json`;
        const fileContent = JSON.stringify({
            ...data,
            exportDate: new Date().toISOString(),
            userEmail: this.currentUser?.email,
            version: '3.0'
        }, null, 2);
        
        const blob = new Blob([fileContent], { type: 'application/json' });
        
        // D'abord, chercher si un fichier existe déjà
        const existingFileId = await this.findExistingBackup();
        
        if (existingFileId) {
            // Mettre à jour le fichier existant
            return this.updateFile(existingFileId, blob, fileName);
        } else {
            // Créer un nouveau fichier
            return this.createFile(blob, fileName);
        }
    }
    
    // Trouver une sauvegarde existante
    async findExistingBackup() {
        try {
            const response = await fetch(
                'https://www.googleapis.com/drive/v3/files?q=name contains \'jirama_backup\' and trashed=false&orderBy=modifiedTime desc&pageSize=1',
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );
            
            const result = await response.json();
            
            if (result.files && result.files.length > 0) {
                return result.files[0].id;
            }
            return null;
        } catch (error) {
            console.error('Erreur recherche fichier:', error);
            return null;
        }
    }
    
    // Créer un nouveau fichier
    async createFile(blob, fileName) {
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: ['root']
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        
        try {
            const response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    body: form
                }
            );
            
            const result = await response.json();
            
            if (result.id) {
                showNotification('Sauvegarde cloud effectuée avec succès !', 'success');
                this.updateLastSyncInfo();
                return true;
            } else {
                throw new Error(result.error?.message || 'Erreur');
            }
        } catch (error) {
            console.error('Erreur création fichier:', error);
            showNotification('Erreur lors de la sauvegarde', 'error');
            return false;
        }
    }
    
    // Mettre à jour un fichier existant
    async updateFile(fileId, blob, fileName) {
        try {
            const response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    body: blob
                }
            );
            
            const result = await response.json();
            
            if (result.id) {
                showNotification('Sauvegarde cloud mise à jour avec succès !', 'success');
                this.updateLastSyncInfo();
                return true;
            } else {
                throw new Error(result.error?.message || 'Erreur');
            }
        } catch (error) {
            console.error('Erreur mise à jour fichier:', error);
            showNotification('Erreur lors de la mise à jour', 'error');
            return false;
        }
    }
    
    // Restaurer les données depuis Google Drive
    async restoreData() {
        if (!this.isSignedIn || !this.accessToken) {
            showNotification('Veuillez vous connecter à Google Drive d\'abord', 'info');
            await this.signIn();
            return null;
        }
        
        if (!confirm('⚠️ Cette action remplacera toutes vos données actuelles. Continuer ?')) {
            return null;
        }
        
        showNotification('Recherche des sauvegardes...', 'info');
        
        try {
            // Lister les sauvegardes
            const response = await fetch(
                'https://www.googleapis.com/drive/v3/files?q=name contains \'jirama_backup\' and trashed=false&orderBy=modifiedTime desc&pageSize=10',
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );
            
            const result = await response.json();
            
            if (!result.files || result.files.length === 0) {
                showNotification('Aucune sauvegarde trouvée', 'info');
                return null;
            }
            
            // Si une seule sauvegarde, la restaurer directement
            if (result.files.length === 1) {
                return this.downloadAndRestore(result.files[0].id);
            }
            
            // Sinon, demander à l'utilisateur de choisir
            const backupList = result.files.map((f, i) => 
                `${i + 1}. ${f.name} (${new Date(f.modifiedTime).toLocaleString()})`
            ).join('\n');
            
            const choice = prompt(`Choisissez une sauvegarde :\n\n${backupList}\n\nEntrez le numéro (1-${result.files.length}) :`, '1');
            const selectedIndex = parseInt(choice) - 1;
            
            if (selectedIndex >= 0 && selectedIndex < result.files.length) {
                return this.downloadAndRestore(result.files[selectedIndex].id);
            }
            
            return null;
            
        } catch (error) {
            console.error('Erreur restauration:', error);
            showNotification('Erreur lors de la restauration', 'error');
            return null;
        }
    }
    
    async downloadAndRestore(fileId) {
        showNotification('Téléchargement de la sauvegarde...', 'info');
        
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );
            
            const data = await response.json();
            showNotification('Données restaurées avec succès !', 'success');
            return data;
            
        } catch (error) {
            console.error('Erreur téléchargement:', error);
            showNotification('Erreur lors du téléchargement', 'error');
            return null;
        }
    }
    
    // ========================================
    // INTERFACE UTILISATEUR
    // ========================================
    
    displayUserInfo() {
        const container = document.getElementById('cloudUserInfo');
        if (!container) return;
        
        if (this.currentUser) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: rgba(0,212,255,0.1); border-radius: 12px;">
                    <img src="${this.currentUser.picture || 'https://via.placeholder.com/40'}" 
                         style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <div style="font-weight: bold;">${escapeHtml(this.currentUser.name)}</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.6);">${escapeHtml(this.currentUser.email)}</div>
                    </div>
                    <button onclick="cloudStorage.signOut()" style="margin-left: auto; background: rgba(255,107,107,0.2); border: none; padding: 5px 10px; border-radius: 8px; color: #ff6b6b; cursor: pointer;">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <button class="btn-glow" onclick="cloudStorage.signIn()" style="width: 100%;">
                    <i class="fab fa-google"></i> Se connecter avec Google
                </button>
            `;
        }
    }
    
    updateUIAfterLogin() {
        this.displayUserInfo();
        
        // Activer les boutons de sauvegarde
        const saveBtn = document.getElementById('cloudSaveBtn');
        const restoreBtn = document.getElementById('cloudRestoreBtn');
        if (saveBtn) saveBtn.disabled = false;
        if (restoreBtn) restoreBtn.disabled = false;
    }
    
    updateUIAfterLogout() {
        this.displayUserInfo();
        
        // Désactiver les boutons de sauvegarde
        const saveBtn = document.getElementById('cloudSaveBtn');
        const restoreBtn = document.getElementById('cloudRestoreBtn');
        if (saveBtn) saveBtn.disabled = true;
        if (restoreBtn) restoreBtn.disabled = true;
    }
    
    updateLastSyncInfo() {
        const lastSyncElem = document.getElementById('lastSync');
        if (lastSyncElem) {
            lastSyncElem.textContent = new Date().toLocaleString();
        }
    }
    
    // ========================================
    // SAUVEGARDE AUTOMATIQUE
    // ========================================
    
    startAutoSync(intervalMinutes = 60) {
        setInterval(async () => {
            if (this.isSignedIn && window.autoSyncEnabled) {
                console.log('🔄 Sauvegarde automatique...');
                const data = this.collectCurrentData();
                await this.saveData(data);
            }
        }, intervalMinutes * 60 * 1000);
    }
    
    collectCurrentData() {
        return {
            persons: window.persons || [],
            appliances: window.appliances || [],
            commonExpenses: window.commonExpenses || [],
            evolutionData: window.evolutionData || [],
            history: window.history || [],
            settings: {
                elecBillAmount: window.elecBillAmount,
                waterBillAmount: window.waterBillAmount,
                elecConsumption: window.elecConsumption,
                waterConsumption: window.waterConsumption,
                elecMethod: window.elecMethod,
                waterMethod: window.waterMethod,
                elecTranchesEnabled: window.elecTranchesEnabled,
                waterTranchesEnabled: window.waterTranchesEnabled,
                electricityTranches: window.electricityTranches,
                waterTranches: window.waterTranches
            }
        };
    }
}

// Créer une instance globale
const cloudStorage = new CloudStorage();

// Exporter pour utilisation
window.cloudStorage = cloudStorage;
