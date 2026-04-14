// ========================================
// DONNÉES PRINCIPALES
// ========================================

let persons = [];
let appliances = [];
let currentPeriod = '2026-01';
let history = [];

let evolutionData = [];
let evolutionChart;

let actualPricePerKwh = 0;
let actualPricePerM3 = 0;

let elecBillAmount = 0;
let waterBillAmount = 0;
let elecConsumption = 0;
let waterConsumption = 0;

let elecMethod = 'basedOnBill';
let waterMethod = 'equitable';
let elecTarifMethod = 'simple';
let pricePerKwhSimple = 550;

let elecTranchesEnabled = false;
let electricityTranches = [];
let waterTranchesEnabled = false;
let waterTranches = [];

let elecTrancheCounter = 0;
let waterTrancheCounter = 0;

let elecChart, appliancesChart, budgetChart;

let commonExpenses = [];
let guests = [];
let virtualAccounts = {};

let emailNotificationsEnabled = false;
let paymentRemindersEnabled = false;
let reminderDays = 3;

let gapiInitialized = false;
let tokenClient = null;
let gapiAccessToken = null;
let autoSyncEnabled = false;
let lastSyncDate = null;

let currentUser = null;
let users = [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrateur' },
    { id: 2, username: 'rakoto', password: 'rakoto123', role: 'user', name: 'Rakoto Jean' },
    { id: 3, username: 'raso', password: 'raso123', role: 'user', name: 'Raso Marie' }
];

// Cloud Storage

// ========================================
// UTILITAIRES
// ========================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showNotification(message, type) {
    try {
        // Éviter la récursion infinie
        if (window._showingNotification) return;
        window._showingNotification = true;
        
        // Supprimer les anciennes notifications
        const oldToasts = document.querySelectorAll('.toast-notification');
        oldToasts.forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.innerHTML = `<div class="toast-icon"><i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i></div>
            <div class="toast-content"><strong>${type === 'success' ? 'Succès' : 'Information'}</strong><p>${message}</p></div>
            <div class="toast-progress"></div>`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast && toast.remove) toast.remove();
            window._showingNotification = false;
        }, 3000);
    } catch (error) {
        console.warn("Erreur notification:", error);
        window._showingNotification = false;
        alert(message);
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
    if (tabId === 'billing') updateBilling();
    if (tabId === 'history') updateHistory();
}

// ========================================
// DONNÉES ET INITIALISATION
// ========================================

function initDefaultTranches() {
    electricityTranches = [
        { id: 1, min: 0, max: 50, price: 450 },
        { id: 2, min: 51, max: 150, price: 550 },
        { id: 3, min: 151, max: 300, price: 650 },
        { id: 4, min: 301, max: Infinity, price: 750 }
    ];
    waterTranches = [
        { id: 1, min: 0, max: 10, price: 2000 },
        { id: 2, min: 11, max: 25, price: 2500 },
        { id: 3, min: 26, max: 50, price: 3000 },
        { id: 4, min: 51, max: Infinity, price: 3500 }
    ];
    elecTrancheCounter = 4;
    waterTrancheCounter = 4;
}

function generatePeriodOptions() {
    const periodSelect = document.getElementById('period');
    if (!periodSelect) return;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const startYear = 2026;
    const endYear = currentYear + 1000;
    periodSelect.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
        for (let month = 0; month < 12; month++) {
            const value = `${year}-${String(month + 1).padStart(2, '0')}`;
            const label = `${monthNames[month]} ${year}`;
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            if (year === currentYear && month === currentMonth) option.selected = true;
            periodSelect.appendChild(option);
        }
    }
}

function calculateActualPrices() {
    const elecBill = parseFloat(document.getElementById('elecBillAmount')?.value) || 0;
    const elecKwh = parseFloat(document.getElementById('elecConsumption')?.value) || 0;
    const waterBill = parseFloat(document.getElementById('waterBillAmount')?.value) || 0;
    const waterM3 = parseFloat(document.getElementById('waterConsumption')?.value) || 0;
    
    if (elecKwh > 0 && elecBill > 0) {
        actualPricePerKwh = elecBill / elecKwh;
        const actualPriceElem = document.getElementById('actualPricePerKwh');
        if (actualPriceElem) actualPriceElem.textContent = actualPricePerKwh.toFixed(2) + ' Ar/kWh';
    } else {
        actualPricePerKwh = 0;
        const actualPriceElem = document.getElementById('actualPricePerKwh');
        if (actualPriceElem) actualPriceElem.textContent = 'En attente des données';
    }
    
    if (waterM3 > 0 && waterBill > 0) {
        actualPricePerM3 = waterBill / waterM3;
        const actualPriceElem = document.getElementById('actualPricePerM3');
        if (actualPriceElem) actualPriceElem.textContent = actualPricePerM3.toFixed(2) + ' Ar/m³';
    } else {
        actualPricePerM3 = 0;
        const actualPriceElem = document.getElementById('actualPricePerM3');
        if (actualPriceElem) actualPriceElem.textContent = 'En attente des données';
    }
}

function calculateElectricityCost(consumptionKwh) {
    if (elecMethod === 'basedOnBill' && actualPricePerKwh > 0 && !elecTranchesEnabled) {
        return consumptionKwh * actualPricePerKwh;
    }
    if (!elecTranchesEnabled || electricityTranches.length === 0) {
        return consumptionKwh * actualPricePerKwh;
    }
    let remaining = consumptionKwh;
    let totalCost = 0;
    let sortedTranches = [...electricityTranches].sort((a, b) => a.min - b.min);
    for (let tranche of sortedTranches) {
        if (remaining <= 0) break;
        let trancheMax = tranche.max === Infinity ? Infinity : tranche.max;
        let trancheSize = trancheMax === Infinity ? Infinity : trancheMax - tranche.min + 1;
        if (trancheMax === Infinity) {
            totalCost += remaining * tranche.price;
            break;
        }
        let consumptionInTranche = Math.min(remaining, trancheSize);
        totalCost += consumptionInTranche * tranche.price;
        remaining -= consumptionInTranche;
    }
    return totalCost;
}

function calculateWaterCost(consumptionM3) {
    if (!waterTranchesEnabled || waterTranches.length === 0) {
        return consumptionM3 * actualPricePerM3;
    }
    let remaining = consumptionM3;
    let totalCost = 0;
    let sortedTranches = [...waterTranches].sort((a, b) => a.min - b.min);
    for (let tranche of sortedTranches) {
        if (remaining <= 0) break;
        let trancheMax = tranche.max === Infinity ? Infinity : tranche.max;
        let trancheSize = trancheMax === Infinity ? Infinity : trancheMax - tranche.min + 1;
        if (trancheMax === Infinity) {
            totalCost += remaining * tranche.price;
            break;
        }
        let consumptionInTranche = Math.min(remaining, trancheSize);
        totalCost += consumptionInTranche * tranche.price;
        remaining -= consumptionInTranche;
    }
    return totalCost;
}

function calculateElectricityCharges() {
    const totalPersonsCoefficient = persons.reduce((sum, p) => sum + p.coefficient, 0);
    const results = [];

    if (elecMethod === 'basedOnBill' && elecBillAmount > 0) {
        // Méthode 1 : facture totale répartie selon les coefficients
        persons.forEach(person => {
            const share = totalPersonsCoefficient > 0 ? (elecBillAmount / totalPersonsCoefficient) * person.coefficient : 0;
            results.push({ personId: person.id, personName: person.name, coefficient: person.coefficient, individualCost: 0, sharedCost: share, totalElectricity: share });
        });

    } else if (elecMethod === 'basedOnBillAndAppliances' && elecBillAmount > 0) {
        // Méthode 3 : facture totale dont on déduit les coûts individuels
        // Prix de référence : prix réel/kWh ou estimé depuis la facture
        const priceRef = (actualPricePerKwh > 0)
            ? actualPricePerKwh
            : (elecBillAmount > 0 && elecConsumption > 0 ? elecBillAmount / elecConsumption : 0);

        // a) Coût des appareils individuels par personne
        const indivCosts = {};
        let totalIndiv = 0;
        persons.forEach(function(person) {
            const myAppliances = appliances.filter(function(a) {
                return a.type === 'individual' && a.personId === person.id;
            });
            let cost = 0;
            myAppliances.forEach(function(a) {
                const kwh = a.consumption || ((a.power * a.hoursPerDay * a.daysPerMonth) / 1000);
                cost += kwh * priceRef;
            });
            indivCosts[person.id] = cost;
            totalIndiv += cost;
        });

        // b) Part collective = facture totale - total appareils individuels (min 0)
        const collective = Math.max(0, elecBillAmount - totalIndiv);

        // c) Chaque personne : part collective (selon coefficient) + coût individuel
        persons.forEach(function(person) {
            const collShare = totalPersonsCoefficient > 0
                ? (collective / totalPersonsCoefficient) * person.coefficient
                : 0;
            const indCost = indivCosts[person.id] || 0;
            results.push({
                personId: person.id,
                personName: person.name,
                coefficient: person.coefficient,
                individualCost: indCost,
                sharedCost: collShare,
                totalElectricity: indCost + collShare
            });
        });

    } else {
        // Méthode 2 : basé sur les appareils seuls
        persons.forEach(person => {
            let individualCost = 0, sharedCost = 0;
            const individualAppliances = appliances.filter(a => a.type === 'individual' && a.personId === person.id);
            individualAppliances.forEach(appliance => { individualCost += calculateElectricityCost(appliance.consumption); });
            const sharedAppliances = appliances.filter(a => a.type === 'shared');
            sharedAppliances.forEach(appliance => {
                const cost = calculateElectricityCost(appliance.consumption) / (totalPersonsCoefficient || 1);
                sharedCost += cost * person.coefficient;
            });
            results.push({ personId: person.id, personName: person.name, coefficient: person.coefficient, individualCost, sharedCost, totalElectricity: individualCost + sharedCost });
        });
    }
    return results;
}

function calculateWaterCharges() {
    const totalCoefficient = persons.reduce((sum, p) => sum + p.coefficient, 0);
    const totalWaterCost = waterBillAmount > 0 ? waterBillAmount : calculateWaterCost(waterConsumption);
    if (waterMethod === 'basedOnConsumption') {
        return persons.map(person => ({ personId: person.id, personName: person.name, coefficient: person.coefficient, waterCost: totalCoefficient > 0 ? (totalWaterCost / totalCoefficient) * person.coefficient : 0 }));
    } else {
        return persons.map(person => ({ personId: person.id, personName: person.name, coefficient: person.coefficient, waterCost: persons.length > 0 ? totalWaterCost / persons.length : 0 }));
    }
}

function getTotalCharges() {
    const elecCharges = calculateElectricityCharges();
    const waterCharges = calculateWaterCharges();
    return persons.map(person => {
        const elec = elecCharges.find(e => e.personId === person.id);
        const water = waterCharges.find(w => w.personId === person.id);
        return { personId: person.id, personName: person.name, electricityCost: elec ? elec.totalElectricity : 0, waterCost: water ? water.waterCost : 0, totalCost: (elec ? elec.totalElectricity : 0) + (water ? water.waterCost : 0) };
    });
}

function saveData() {
    const data = {
        persons, appliances, commonExpenses, evolutionData, guests, virtualAccounts, users,
        elecBillAmount, waterBillAmount, elecConsumption, waterConsumption,
        elecMethod, waterMethod, elecTranchesEnabled, waterTranchesEnabled,
        electricityTranches, waterTranches, history
    };
    localStorage.setItem('jiramaChargeManager', JSON.stringify(data));
}

function loadData() {
    const savedData = localStorage.getItem('jiramaChargeManager');
    if (savedData) {
        const data = JSON.parse(savedData);
        persons = data.persons || [];
        appliances = data.appliances || [];
        commonExpenses = data.commonExpenses || [];
        evolutionData = data.evolutionData || [];
        guests = data.guests || [];
        virtualAccounts = data.virtualAccounts || {};
        users = data.users || [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrateur' }
        ];
        elecBillAmount = data.elecBillAmount || 0;
        waterBillAmount = data.waterBillAmount || 0;
        elecConsumption = data.elecConsumption || 0;
        waterConsumption = data.waterConsumption || 0;
        elecMethod = data.elecMethod || 'basedOnBill';
        waterMethod = data.waterMethod || 'equitable';
        elecTranchesEnabled = data.elecTranchesEnabled || false;
        waterTranchesEnabled = data.waterTranchesEnabled || false;
        electricityTranches = data.electricityTranches || [];
        waterTranches = data.waterTranches || [];
        history = data.history || [];
        if (electricityTranches.length === 0) initDefaultTranches();
        if (waterTranches.length === 0) initDefaultTranches();
    } else {
        persons = [
            { id: 1, name: 'Rakoto Jean', email: 'rakoto@email.com', phone: '032XXXXXXX', coefficient: 1 },
            { id: 2, name: 'Raso Marie', email: 'marie@email.com', phone: '033XXXXXXX', coefficient: 0.8 }
        ];
        appliances = [];
        waterConsumption = 12;
        users = [
            { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrateur' },
            { id: 2, username: 'rakoto', password: 'rakoto123', role: 'user', name: 'Rakoto Jean', email: 'rakoto@email.com', personId: 1 },
            { id: 3, username: 'raso', password: 'raso123', role: 'user', name: 'Raso Marie', email: 'marie@email.com', personId: 2 }
        ];
        initDefaultTranches();
    }
    loadSettings();
}

// ========================================
// PERSONNES
// ========================================

function updatePersonSelect() {
    const select = document.getElementById('appliancePersonId');
    if (select) select.innerHTML = persons.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

function updatePersonsList() {
    const container = document.getElementById('personsList');
    if (!container) {
        console.error("❌ Conteneur personsList non trouvé");
        return;
    }
    
    console.log(`🔄 Mise à jour de la liste des personnes: ${persons.length} personnes`);
    
    if (persons.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                Aucun colocataire enregistré<br>
                <small>Cliquez sur "Ajouter un colocataire" pour commencer</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = persons.map(person => `
        <div class="person-card">
            <h3><i class="fas fa-user-circle"></i> ${escapeHtml(person.name)}</h3>
            <p><i class="fas fa-envelope"></i> ${escapeHtml(person.email || 'Non renseigné')}</p>
            <p><i class="fas fa-phone"></i> ${escapeHtml(person.phone || 'Non renseigné')}</p>
            <p><i class="fas fa-chart-line"></i> Présence: ${person.coefficient * 100}%</p>
            <div class="card-actions">
                <button class="btn-icon edit" onclick="showPersonModal(${person.id})"><i class="fas fa-edit"></i> Modifier</button>
                <button class="btn-icon delete" onclick="deletePerson(${person.id})"><i class="fas fa-trash"></i> Supprimer</button>
            </div>
        </div>
    `).join('');
    
    updatePersonSelect();
}

function showPersonModal(personId = null) {
    const modal = document.getElementById('personModal');
    const title = document.getElementById('personModalTitle');
    if (personId !== null) {
        const person = persons.find(p => p.id === personId);
        if (person) {
            title.innerHTML = '<i class="fas fa-user-edit"></i> Modifier un colocataire';
            document.getElementById('personId').value = person.id;
            document.getElementById('personName').value = person.name;
            document.getElementById('personEmail').value = person.email || '';
            document.getElementById('personPhone').value = person.phone || '';
            document.getElementById('personCoefficientSlider').value = person.coefficient;
            document.getElementById('coefficientValue').textContent = Math.round(person.coefficient * 100) + '%';
        }
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> Ajouter un colocataire';
        document.getElementById('personForm').reset();
        document.getElementById('personId').value = '';
        document.getElementById('personCoefficientSlider').value = 1;
        document.getElementById('coefficientValue').textContent = '100%';
    }
    modal.style.display = 'block';
}

function closePersonModal() { document.getElementById('personModal').style.display = 'none'; }

function savePerson() {
    console.log("🔍 savePerson appelée");
    
    const id = document.getElementById('personId').value;
    const name = document.getElementById('personName').value;
    const email = document.getElementById('personEmail').value;
    const phone = document.getElementById('personPhone').value;
    const coefficient = parseFloat(document.getElementById('personCoefficientSlider').value);
    
    if (!name) {
        showNotification('Veuillez entrer un nom', 'error');
        console.log("❌ Nom manquant");
        return;
    }
    
    console.log(`📝 Sauvegarde personne: ${name}, ID: ${id || 'nouveau'}`);
    
    const personData = {
        id: id ? parseInt(id) : Date.now(),
        name: name,
        email: email,
        phone: phone,
        coefficient: coefficient
    };
    
    if (id) {
        const index = persons.findIndex(p => p.id === parseInt(id));
        if (index !== -1) {
            persons[index] = personData;
            showNotification('Colocataire modifié avec succès', 'success');
            console.log(`✅ Personne modifiée: ${name}`);
        } else {
            console.error("❌ Personne non trouvée pour modification");
        }
    } else {
        persons.push(personData);
        showNotification('Colocataire ajouté avec succès', 'success');
        console.log(`✅ Nouvelle personne ajoutée: ${name}`);
        
        if (email) {
            const username = name.toLowerCase().replace(/\s/g, '').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let finalUsername = username;
            let counter = 1;
            while (users.find(u => u.username === finalUsername)) {
                finalUsername = username + counter;
                counter++;
            }
            
            users.push({
                id: users.length + 1,
                username: finalUsername,
                password: 'jirama123',
                role: 'user',
                name: name,
                email: email,
                personId: personData.id
            });
            showNotification(`Compte créé pour ${name} (nom d'utilisateur: ${finalUsername}, mot de passe: jirama123)`, 'success');
            if (typeof updateUsersListPreview === 'function') updateUsersListPreview();
        }
    }
    
    saveData();
    updatePersonsList();
    updatePersonSelect();
    updateDashboard();
    updateBilling();
    updateEmailList();
    closePersonModal();
    console.log(`✅ Personne sauvegardée, total: ${persons.length} colocataires`);
}

function deletePerson(id) {
    console.log(`🔍 deletePerson appelé, ID: ${id}`);
    const person = persons.find(p => p.id === id);
    if (!person) {
        console.error(`❌ Personne avec ID ${id} non trouvée`);
        return;
    }
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${person.name} ?\nLes appareils qui lui sont assignés seront également supprimés.`)) {
        persons = persons.filter(p => p.id !== id);
        appliances = appliances.filter(a => a.personId !== id);
        saveData();
        updatePersonsList();
        updateAppliancesList();
        updateDashboard();
        updateBilling();
        updateEmailList();
        showNotification(`Colocataire "${person.name}" supprimé`, 'success');
        console.log(`✅ Personne supprimée: ${person.name}`);
    }
}

// ========================================
// APPAREILS
// ========================================

function updateAppliancesList() {
    const container = document.getElementById('appliancesList');
    if (!container) {
        console.error("❌ Conteneur appliancesList non trouvé");
        return;
    }
    
    console.log(`🔄 Mise à jour de la liste des appareils: ${appliances.length} appareils`);
    
    if (appliances.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
                <i class="fas fa-plug" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                Aucun appareil enregistré<br>
                <small>Cliquez sur "Ajouter un appareil" pour commencer</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appliances.map(appliance => {
        const consumption = appliance.consumption.toFixed(2);
        const cost = calculateElectricityCost(appliance.consumption).toFixed(0);
        const person = appliance.personId ? persons.find(p => p.id === appliance.personId) : null;
        const categoryIcons = { chauffage: '🔥', cuisson: '🍳', multimedia: '📺', electromenager: '🧺', eclairage: '💡', autre: '🔌' };
        const categoryIcon = categoryIcons[appliance.category] || '🔌';
        
        return `
            <div class="appliance-card">
                <h3><i class="fas fa-plug"></i> ${escapeHtml(appliance.name)}</h3>
                <p><i class="fas fa-bolt"></i> Puissance: ${appliance.power} W</p>
                <p><i class="fas fa-clock"></i> ${appliance.hoursPerDay}h/jour, ${appliance.daysPerMonth} jours/mois</p>
                <p><i class="fas fa-chart-line"></i> Consommation: ${consumption} kWh/mois</p>
                <p><i class="fas fa-euro-sign"></i> Coût: ${cost} Ar</p>
                <p><i class="fas fa-tag"></i> Type: ${appliance.type === 'individual' ? '👤 Individuel' : '👥 Partagé'}</p>
                <p><i class="fas fa-category"></i> ${categoryIcon} ${appliance.category}</p>
                ${person ? `<p><i class="fas fa-user"></i> Assigné à: ${escapeHtml(person.name)}</p>` : ''}
                <div class="card-actions">
                    <button class="btn-icon edit" onclick="showApplianceModal(${appliance.id})"><i class="fas fa-edit"></i> Modifier</button>
                    <button class="btn-icon delete" onclick="deleteAppliance(${appliance.id})"><i class="fas fa-trash"></i> Supprimer</button>
                </div>
            </div>
        `;
    }).join('');
}

function showApplianceModal(applianceId = null) {
    console.log(`🔍 showApplianceModal appelé, ID: ${applianceId}`);
    const modal = document.getElementById('applianceModal');
    const title = document.getElementById('applianceModalTitle');
    if (!modal) { console.error("❌ Modal appareil non trouvé"); return; }
    updatePersonSelect();
    
    if (applianceId !== null) {
        const appliance = appliances.find(a => a.id === applianceId);
        if (appliance) {
            title.innerHTML = '<i class="fas fa-edit"></i> Modifier un appareil';
            document.getElementById('applianceId').value = appliance.id;
            document.getElementById('applianceName').value = appliance.name;
            document.getElementById('appliancePower').value = appliance.power;
            document.getElementById('applianceHours').value = appliance.hoursPerDay;
            document.getElementById('applianceDays').value = appliance.daysPerMonth;
            document.getElementById('applianceType').value = appliance.type;
            document.getElementById('appliancePersonId').value = appliance.personId || '';
            document.getElementById('applianceCategory').value = appliance.category;
            const personSelectGroup = document.getElementById('personSelectGroup');
            if (personSelectGroup) personSelectGroup.style.display = appliance.type === 'individual' ? 'block' : 'none';
            setTimeout(() => { if (typeof initConsumptionPreview === 'function') initConsumptionPreview(); }, 100);
            console.log(`📝 Édition de l'appareil: ${appliance.name}`);
        } else {
            console.error(`❌ Appareil avec ID ${applianceId} non trouvé`);
        }
    } else {
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Ajouter un appareil';
        document.getElementById('applianceForm').reset();
        document.getElementById('applianceId').value = '';
        document.getElementById('applianceType').value = 'individual';
        document.getElementById('applianceCategory').value = 'electromenager';
        const personSelectGroup = document.getElementById('personSelectGroup');
        if (personSelectGroup) personSelectGroup.style.display = 'block';
        const previewSpan = document.getElementById('consumptionPreview');
        if (previewSpan) previewSpan.textContent = '0 kWh/mois';
        console.log("📝 Ajout d'un nouvel appareil");
    }
    modal.style.display = 'block';
}

function closeApplianceModal() { document.getElementById('applianceModal').style.display = 'none'; }

function saveAppliance() {
    console.log("🔍 saveAppliance appelée");
    const id = document.getElementById('applianceId').value;
    const name = document.getElementById('applianceName').value;
    const power = parseFloat(document.getElementById('appliancePower').value);
    const hoursPerDay = parseFloat(document.getElementById('applianceHours').value);
    const daysPerMonth = parseInt(document.getElementById('applianceDays').value);
    const type = document.getElementById('applianceType').value;
    const personId = type === 'individual' ? parseInt(document.getElementById('appliancePersonId').value) : null;
    const category = document.getElementById('applianceCategory').value;
    
    if (!name) { showNotification('Veuillez entrer un nom d\'appareil', 'error'); return; }
    if (!power || power <= 0) { showNotification('Veuillez entrer une puissance valide', 'error'); return; }
    
    console.log(`📝 Sauvegarde appareil: ${name}, ID: ${id || 'nouveau'}`);
    const consumption = (power * hoursPerDay * daysPerMonth) / 1000;
    const applianceData = { id: id ? parseFloat(id) : Date.now(), name, power, hoursPerDay, daysPerMonth, type, personId, category, consumption };
    
    if (id) {
        const index = appliances.findIndex(a => String(a.id) === String(id));
        if (index !== -1) {
            appliances[index] = applianceData;
            showNotification('Appareil modifié avec succès', 'success');
            console.log(`✅ Appareil modifié: ${name}`);
        } else {
            console.error("❌ Appareil non trouvé pour modification");
            showNotification('Erreur: appareil non trouvé', 'error');
            return;
        }
    } else {
        appliances.push(applianceData);
        showNotification('Appareil ajouté avec succès', 'success');
        console.log(`✅ Nouvel appareil ajouté: ${name}, consommation: ${consumption.toFixed(2)} kWh`);
    }
    
    saveData();
    updateAppliancesList();
    updateDashboard();
    updateBilling();
    if (typeof updateCharts === 'function') updateCharts();
    closeApplianceModal();
    console.log(`✅ Appareil sauvegardé, total: ${appliances.length} appareils`);
}

function deleteAppliance(id) {
    console.log(`🔍 deleteAppliance appelé, ID: ${id}`);
    const appliance = appliances.find(a => a.id === id);
    if (!appliance) { console.error(`❌ Appareil avec ID ${id} non trouvé`); return; }
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'appareil "${appliance.name}" ?`)) {
        appliances = appliances.filter(a => a.id !== id);
        saveData();
        updateAppliancesList();
        updateDashboard();
        updateBilling();
        showNotification(`Appareil "${appliance.name}" supprimé`, 'success');
        console.log(`✅ Appareil supprimé: ${appliance.name}`);
    }
}

function importDefaultAppliances() {
    const defaultAppliances = [
        { name: 'Réfrigérateur', power: 150, hoursPerDay: 24, daysPerMonth: 30, type: 'shared', category: 'electromenager' },
        { name: 'Téléviseur', power: 100, hoursPerDay: 5, daysPerMonth: 30, type: 'shared', category: 'multimedia' },
        { name: 'Lave-linge', power: 2000, hoursPerDay: 1, daysPerMonth: 8, type: 'shared', category: 'electromenager' },
        { name: 'Ampoule LED', power: 10, hoursPerDay: 6, daysPerMonth: 30, type: 'shared', category: 'eclairage' },
        { name: 'Ordinateur', power: 200, hoursPerDay: 4, daysPerMonth: 22, type: 'individual', category: 'multimedia' }
    ];
    defaultAppliances.forEach(app => {
        const consumption = (app.power * app.hoursPerDay * app.daysPerMonth) / 1000;
        appliances.push({ id: Date.now() + Math.random(), ...app, consumption, personId: app.type === 'individual' && persons[0] ? persons[0].id : null });
    });
    saveData();
    updateAppliancesList();
    updateDashboard();
    updateBilling();
    showNotification('Appareils importés avec succès !', 'success');
}

function initConsumptionPreview() {
    const powerInput = document.getElementById('appliancePower');
    const hoursInput = document.getElementById('applianceHours');
    const daysInput = document.getElementById('applianceDays');
    const previewSpan = document.getElementById('consumptionPreview');
    function updatePreview() {
        const power = parseFloat(powerInput?.value) || 0;
        const hours = parseFloat(hoursInput?.value) || 0;
        const days = parseFloat(daysInput?.value) || 0;
        const consumption = (power * hours * days) / 1000;
        if (previewSpan) previewSpan.textContent = `${consumption.toFixed(2)} kWh/mois`;
    }
    if (powerInput) powerInput.addEventListener('input', updatePreview);
    if (hoursInput) hoursInput.addEventListener('input', updatePreview);
    if (daysInput) daysInput.addEventListener('input', updatePreview);
    updatePreview();
}

// ========================================
// FACTURATION
// ========================================

function updateBilling() {
    console.log("🔄 Mise à jour de la facturation");
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    const totalChargesElem = document.getElementById('totalCharges');
    if (totalChargesElem) totalChargesElem.textContent = `${total.toFixed(0)} Ar`;
    const container = document.getElementById('billingDetails');
    if (!container) return;
    
    if (charges.length === 0 || persons.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);"><i class="fas fa-file-invoice" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>Aucune donnée à afficher<br><small>Ajoutez des colocataires et des appareils pour voir la facturation</small></div>`;
        return;
    }
    
    container.innerHTML = `<table class="billing-table"><thead><tr><th>Colocataire</th><th>Électricité (Ar)</th><th>Eau (Ar)</th><th>Total (Ar)</th><th>Statut</th><th>Action</th></tr></thead><tbody>${charges.map(charge => { const percent = total > 0 ? ((charge.totalCost / total) * 100).toFixed(1) : 0; return `<tr><td><strong>${escapeHtml(charge.personName)}</strong></td><td class="amount">${charge.electricityCost.toFixed(0)} Ar</td><td class="amount">${charge.waterCost.toFixed(0)} Ar</td><td class="amount"><strong>${charge.totalCost.toFixed(0)} Ar</strong> (${percent}%)</td><td><span class="unpaid-badge" id="status-${charge.personId}">Non payé</span></td><td><button class="btn-glow" onclick="markAsPaid(${charge.personId})" style="padding: 5px 15px; font-size: 12px;"><i class="fas fa-check"></i> Payé</button></td></tr>`; }).join('')}<tr class="total-row"><td><strong>TOTAL</strong></td><td class="amount"><strong>${charges.reduce((sum, c) => sum + c.electricityCost, 0).toFixed(0)} Ar</strong></td><td class="amount"><strong>${charges.reduce((sum, c) => sum + c.waterCost, 0).toFixed(0)} Ar</strong></td><td class="amount"><strong>${total.toFixed(0)} Ar</strong></td><td></td><td></td></tr></tbody></table>`;
    console.log(`✅ Facturation mise à jour: ${charges.length} charges, total: ${total.toFixed(0)} Ar`);
}

function markAsPaid(personId) {
    const statusSpan = document.getElementById(`status-${personId}`);
    if (statusSpan) {
        statusSpan.className = 'paid-badge';
        statusSpan.textContent = 'Payé';
        const period = document.getElementById('period').value;
        const person = persons.find(p => p.id === personId);
        const charges = getTotalCharges();
        const charge = charges.find(c => c.personId === personId);
        if (charge && person) {
            history.unshift({ date: new Date().toISOString(), period, personName: person.name, amount: charge.totalCost, type: 'paiement' });
            saveData();
            updateHistory();
            saveMonthlyData();
        }
        showNotification('Paiement enregistré avec succès !', 'success');
    }
}

function updateHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;
    if (history.length === 0) { container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Aucun historique disponible</p>'; return; }
    container.innerHTML = history.map(item => `<div class="history-item"><p><strong>📅 ${new Date(item.date).toLocaleDateString('fr-FR')}</strong> - ${item.period}</p><p>${item.type === 'facture' ? '📄 Facture générée' : '💰 Paiement enregistré'}</p>${item.personName ? `<p>👤 ${item.personName}</p>` : ''}${item.amount ? `<p>💵 Montant: ${item.amount.toFixed(0)} Ar</p>` : ''}${item.total ? `<p>📊 Total: ${item.total.toFixed(0)} Ar</p>` : ''}</div>`).join('');
}

function clearHistory() {
    if (confirm('Voulez-vous effacer tout l\'historique ?')) {
        history = [];
        saveData();
        updateHistory();
        showNotification('Historique effacé', 'success');
    }
}

function shareBill() {
    if (persons.length === 0) { showNotification('Ajoutez des colocataires avant de partager', 'error'); return; }
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    const period = document.getElementById('period').value;
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [year, month] = period.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    let message = `📄 *Facture des charges - ${monthName} ${year}*\n\n`;
    charges.forEach(charge => { message += `👤 ${charge.personName}:\n   ⚡ Électricité: ${charge.electricityCost.toFixed(0)} Ar\n   💧 Eau: ${charge.waterCost.toFixed(0)} Ar\n   💰 Total: ${charge.totalCost.toFixed(0)} Ar\n\n`; });
    message += `📊 *Total général: ${total.toFixed(0)} Ar*`;
    if (navigator.share) { navigator.share({ title: 'Facture des charges', text: message }).catch(() => { navigator.clipboard.writeText(message); showNotification('Facture copiée dans le presse-papier !', 'success'); }); }
    else { navigator.clipboard.writeText(message); showNotification('Facture copiée dans le presse-papier !', 'success'); }
}

// ========================================
// PARAMÈTRES
// ========================================

function initTarifSections() {
    const methodSelect = document.getElementById('elecTarifMethod');
    const simpleSection = document.getElementById('simpleTarifSection');
    const tranchesSection = document.getElementById('tranchesTarifSection');
    if (methodSelect) {
        methodSelect.addEventListener('change', function() {
            if (this.value === 'simple') { if (simpleSection) simpleSection.style.display = 'block'; if (tranchesSection) tranchesSection.style.display = 'none'; }
            else { if (simpleSection) simpleSection.style.display = 'none'; if (tranchesSection) tranchesSection.style.display = 'block'; }
        });
        methodSelect.value = elecTarifMethod || 'simple';
        if (elecTarifMethod === 'simple') { if (simpleSection) simpleSection.style.display = 'block'; if (tranchesSection) tranchesSection.style.display = 'none'; }
        else { if (simpleSection) simpleSection.style.display = 'none'; if (tranchesSection) tranchesSection.style.display = 'block'; }
    }
    const limitInputs = ['tranche1Limit', 'tranche2Limit', 'tranche3Limit', 'tranche4Limit'];
    limitInputs.forEach(id => { const input = document.getElementById(id); if (input) input.addEventListener('change', updateTrancheDisplays); });
    updateTrancheDisplays();
}

function updateTrancheDisplays() {
    const t1 = electricityTranches[0], t2 = electricityTranches[1], t3 = electricityTranches[2], t4 = electricityTranches[3];
    const limit1Display = document.getElementById('limit1Display');
    const limit2Start = document.getElementById('limit2Start');
    const limit2Display = document.getElementById('limit2Display');
    const limit3Start = document.getElementById('limit3Start');
    const limit3Display = document.getElementById('limit3Display');
    const limit4Display = document.getElementById('limit4Display');
    if (limit1Display) limit1Display.textContent = t1.max;
    if (limit2Start) limit2Start.textContent = t2.min;
    if (limit2Display) limit2Display.textContent = t2.max;
    if (limit3Start) limit3Start.textContent = t3.min;
    if (limit3Display) limit3Display.textContent = t3.max;
    if (limit4Display) limit4Display.textContent = t4.min;
    const tranche1Limit = document.getElementById('tranche1Limit');
    const tranche1Price = document.getElementById('tranche1Price');
    const tranche2Limit = document.getElementById('tranche2Limit');
    const tranche2Price = document.getElementById('tranche2Price');
    const tranche3Limit = document.getElementById('tranche3Limit');
    const tranche3Price = document.getElementById('tranche3Price');
    const tranche4Limit = document.getElementById('tranche4Limit');
    const tranche4Price = document.getElementById('tranche4Price');
    if (tranche1Limit) tranche1Limit.value = t1.max;
    if (tranche1Price) tranche1Price.value = t1.price;
    if (tranche2Limit) tranche2Limit.value = t2.max;
    if (tranche2Price) tranche2Price.value = t2.price;
    if (tranche3Limit) tranche3Limit.value = t3.max;
    if (tranche3Price) tranche3Price.value = t3.price;
    if (tranche4Limit) tranche4Limit.value = t4.min;
    if (tranche4Price) tranche4Price.value = t4.price;
}

function saveSettings() {
    const elecBillInput = document.getElementById('elecBillAmount');
    const waterBillInput = document.getElementById('waterBillAmount');
    const elecConsumptionInput = document.getElementById('elecConsumption');
    const waterConsumptionInput = document.getElementById('waterConsumption');
    const elecMethodSelect = document.getElementById('elecMethod');
    const waterMethodSelect = document.getElementById('waterMethod');
    const elecTranchesEnabledSelect = document.getElementById('elecTranchesEnabled');
    const waterTranchesEnabledSelect = document.getElementById('waterTranchesEnabled');
    const priceSimpleInput = document.getElementById('pricePerKwhSimple');
    const elecTarifMethodSelect = document.getElementById('elecTarifMethod');
    const emailNotificationsSelect = document.getElementById('emailNotifications');
    const autoSyncSelect = document.getElementById('autoSync');
    const paymentRemindersSelect = document.getElementById('paymentReminders');
    const reminderDaysSelect = document.getElementById('reminderDays');
    if (elecBillInput) elecBillAmount = parseFloat(elecBillInput.value) || 0;
    if (waterBillInput) waterBillAmount = parseFloat(waterBillInput.value) || 0;
    if (elecConsumptionInput) elecConsumption = parseFloat(elecConsumptionInput.value) || 0;
    if (waterConsumptionInput) waterConsumption = parseFloat(waterConsumptionInput.value) || 0;
    if (elecMethodSelect) elecMethod = elecMethodSelect.value;
    if (waterMethodSelect) waterMethod = waterMethodSelect.value;
    if (elecTranchesEnabledSelect) elecTranchesEnabled = elecTranchesEnabledSelect.value === 'true';
    if (waterTranchesEnabledSelect) waterTranchesEnabled = waterTranchesEnabledSelect.value === 'true';
    if (priceSimpleInput) pricePerKwhSimple = parseFloat(priceSimpleInput.value) || 550;
    if (elecTarifMethodSelect) elecTarifMethod = elecTarifMethodSelect.value;
    if (emailNotificationsSelect) emailNotificationsEnabled = emailNotificationsSelect.value === 'true';
    if (autoSyncSelect) autoSyncEnabled = autoSyncSelect.value === 'true';
    if (paymentRemindersSelect) paymentRemindersEnabled = paymentRemindersSelect.value === 'true';
    if (reminderDaysSelect) reminderDays = parseInt(reminderDaysSelect.value) || 3;
    calculateActualPrices();
    saveData();
    updateDashboard();
    updateBilling();
    showNotification('Paramètres sauvegardés avec succès !', 'success');
}

function loadSettings() {
    const elecBillInput = document.getElementById('elecBillAmount');
    const waterBillInput = document.getElementById('waterBillAmount');
    const elecConsumptionInput = document.getElementById('elecConsumption');
    const waterConsumptionInput = document.getElementById('waterConsumption');
    const elecMethodSelect = document.getElementById('elecMethod');
    const waterMethodSelect = document.getElementById('waterMethod');
    const elecTranchesEnabledSelect = document.getElementById('elecTranchesEnabled');
    const waterTranchesEnabledSelect = document.getElementById('waterTranchesEnabled');
    const priceSimpleInput = document.getElementById('pricePerKwhSimple');
    const elecTarifMethodSelect = document.getElementById('elecTarifMethod');
    const emailNotificationsSelect = document.getElementById('emailNotifications');
    const autoSyncSelect = document.getElementById('autoSync');
    const paymentRemindersSelect = document.getElementById('paymentReminders');
    const reminderDaysSelect = document.getElementById('reminderDays');
    if (elecBillInput) elecBillInput.value = elecBillAmount;
    if (waterBillInput) waterBillInput.value = waterBillAmount;
    if (elecConsumptionInput) elecConsumptionInput.value = elecConsumption;
    if (waterConsumptionInput) waterConsumptionInput.value = waterConsumption;
    if (elecMethodSelect) elecMethodSelect.value = elecMethod;
    if (waterMethodSelect) waterMethodSelect.value = waterMethod;
    if (elecTranchesEnabledSelect) elecTranchesEnabledSelect.value = elecTranchesEnabled ? 'true' : 'false';
    if (waterTranchesEnabledSelect) waterTranchesEnabledSelect.value = waterTranchesEnabled ? 'true' : 'false';
    if (priceSimpleInput) priceSimpleInput.value = pricePerKwhSimple;
    if (elecTarifMethodSelect) elecTarifMethodSelect.value = elecTarifMethod;
    if (emailNotificationsSelect) emailNotificationsSelect.value = emailNotificationsEnabled ? 'true' : 'false';
    if (autoSyncSelect) autoSyncSelect.value = autoSyncEnabled ? 'true' : 'false';
    if (paymentRemindersSelect) paymentRemindersSelect.value = paymentRemindersEnabled ? 'true' : 'false';
    if (reminderDaysSelect) reminderDaysSelect.value = reminderDays;
    calculateActualPrices();
    renderElecTranches();
    renderWaterTranches();
}

function resetData() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser toutes les données ? Cette action est irréversible.')) {
        persons = [];
        appliances = [];
        history = [];
        commonExpenses = [];
        evolutionData = [];
        guests = [];
        virtualAccounts = {};
        elecBillAmount = 0;
        waterBillAmount = 0;
        waterConsumption = 0;
        elecTranchesEnabled = false;
        waterTranchesEnabled = false;
        initDefaultTranches();
        saveData();
        updatePersonsList();
        updateAppliancesList();
        updateDashboard();
        updateBilling();
        updateHistory();
        updateExpensesList();
        updateEvolutionChart();
        updateWidgets();
        loadSettings();
        showNotification('Données réinitialisées avec succès', 'success');
    }
}

// ========================================
// GRAPHIQUES
// ========================================

function updateDashboard() {
    document.getElementById('totalPersons').textContent = persons.length;
    document.getElementById('totalAppliances').textContent = appliances.length;
    const totalConsumption = appliances.reduce((sum, a) => sum + a.consumption, 0);
    document.getElementById('totalElecConsumption').textContent = `${totalConsumption.toFixed(2)} kWh`;
    document.getElementById('totalWaterConsumption').textContent = `${waterConsumption} m³`;
    updateCharts();
    updateAlerts();
    updateTips();
    updateHeaderStats();
    updateEvolutionChart();
    updateExpensesList();
    updateWidgets();
    updateForecast();
}

function updateHeaderStats() {
    const charges = getTotalCharges();
    const totalBudget = charges.reduce((sum, c) => sum + c.totalCost, 0);
    document.getElementById('headerPersonCount').textContent = persons.length;
    document.getElementById('headerTotalBudget').textContent = `${totalBudget.toFixed(0)} Ar`;
    const period = document.getElementById('period').value;
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [year, month] = period.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    document.getElementById('currentPeriod').textContent = `${monthName} ${year}`;
}

function updateCharts() {
    const elecCharges = calculateElectricityCharges();
    const elecCtx = document.getElementById('elecChart');
    if (elecCtx && elecCharges.length > 0 && elecCharges.some(c => c.totalElectricity > 0)) {
        if (elecChart) elecChart.destroy();
        elecChart = new Chart(elecCtx, {
            type: 'doughnut',
            data: { labels: elecCharges.map(c => c.personName), datasets: [{ data: elecCharges.map(c => c.totalElectricity), backgroundColor: ['#00d4ff', '#0099cc', '#33ddff', '#66e6ff', '#99eeff'], borderWidth: 0, hoverOffset: 10, cutout: '60%', animation: { animateRotate: true, animateScale: true, duration: 1000, easing: 'easeOutBounce' } }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: 'white', font: { size: 10 }, boxWidth: 10, padding: 8 } }, tooltip: { callbacks: { label: function(context) { const value = context.raw; const total = elecCharges.reduce((s, c) => s + c.totalElectricity, 0); const percent = total > 0 ? (value / total * 100).toFixed(1) : 0; return `${context.label}: ${value.toFixed(0)} Ar (${percent}%)`; } } } } }
        });
        elecChart.update();
    } else if (elecCtx) {
        if (elecChart) elecChart.destroy();
        const ctx = elecCtx.getContext('2d');
        ctx.clearRect(0, 0, elecCtx.width, elecCtx.height);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Aucune donnée disponible', elecCtx.width / 2, elecCtx.height / 2);
    }
    const topAppliances = [...appliances].sort((a, b) => b.consumption - a.consumption).slice(0, 5);
    const appCtx = document.getElementById('appliancesChart');
    if (appCtx && topAppliances.length > 0) {
        if (appliancesChart) appliancesChart.destroy();
        appliancesChart = new Chart(appCtx, {
            type: 'bar',
            data: { labels: topAppliances.map(a => a.name), datasets: [{ label: 'Consommation (kWh)', data: topAppliances.map(a => a.consumption), backgroundColor: '#00d4ff', borderRadius: 8, barPercentage: 0.7, categoryPercentage: 0.8, animation: { duration: 1000, easing: 'easeOutQuart' } }] },
            options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true, title: { display: true, text: 'kWh', color: 'white', font: { size: 11 } }, ticks: { color: 'white', stepSize: 50 }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white', font: { size: 10 } }, grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(context) { return `Consommation: ${context.raw.toFixed(2)} kWh`; } } } } }
        });
        appliancesChart.update();
    } else if (appCtx) {
        if (appliancesChart) appliancesChart.destroy();
        const ctx = appCtx.getContext('2d');
        ctx.clearRect(0, 0, appCtx.width, appCtx.height);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Aucun appareil enregistré', appCtx.width / 2, appCtx.height / 2);
    }
}

function updateAlerts() {
    const alertsContainer = document.getElementById('alertsList');
    if (!alertsContainer) return;
    const alerts = [];
    const totalConsumption = appliances.reduce((sum, a) => sum + a.consumption, 0);
    if (totalConsumption > 500) alerts.push('<i class="fas fa-exclamation-triangle"></i> ⚠️ Consommation électrique élevée (>500 kWh)');
    const highPowerAppliances = appliances.filter(a => a.power > 2000);
    if (highPowerAppliances.length > 0) alerts.push(`<i class="fas fa-fire"></i> 🔥 ${highPowerAppliances.length} appareil(s) énergivore(s) détecté(s)`);
    if (elecBillAmount === 0 && waterBillAmount === 0 && persons.length > 0) alerts.push('<i class="fas fa-file-invoice"></i> 💡 Pensez à saisir vos factures JIRAMA dans les paramètres');
    if (persons.length === 0) alerts.push('<i class="fas fa-users"></i> 👥 Ajoutez des colocataires pour commencer');
    if (alerts.length === 0) alertsContainer.innerHTML = '<p><i class="fas fa-check-circle"></i> ✅ Tout est en ordre !</p>';
    else alertsContainer.innerHTML = alerts.map(alert => `<p style="color:rgba(255,255,255,0.85);margin:6px 0;">${alert}</p>`).join('');
}

function updateTips() {
    const tipsContainer = document.getElementById('tipsList');
    if (!tipsContainer) return;
    const tips = ['<i class="fas fa-lightbulb"></i> Éteignez les appareils en veille pour économiser jusqu\'à 10%', '<i class="fas fa-temperature-low"></i> ❄️ Dégivrez régulièrement votre réfrigérateur', '<i class="fas fa-water"></i> 💧 Réparez les fuites d\'eau, une goutte/seconde = 15L/jour', '<i class="fas fa-charging-station"></i> 🔌 Débranchez les chargeurs inutilisés', '<i class="fas fa-sun"></i> ☀️ Utilisez la lumière naturelle autant que possible'];
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipsContainer.innerHTML = `<p>${randomTip}</p>`;
}

function saveMonthlyData() {
    const period = document.getElementById('period').value;
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    const existingIndex = evolutionData.findIndex(d => d.period === period);
    const monthlyData = { period: period, total: total, charges: charges.map(c => ({ name: c.personName, amount: c.totalCost })) };
    if (existingIndex >= 0) evolutionData[existingIndex] = monthlyData;
    else evolutionData.push(monthlyData);
    if (evolutionData.length > 12) evolutionData = evolutionData.slice(-12);
    saveData();
    updateEvolutionChart();
}

function updateEvolutionChart() {
    const ctx = document.getElementById('evolutionChart');
    if (!ctx) return;
    if (evolutionData.length === 0) {
        if (evolutionChart) evolutionChart.destroy();
        evolutionChart = new Chart(ctx, { type: 'line', data: { labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], datasets: [{ label: 'Charges totales (Ar)', data: [0, 0, 0, 0, 0, 0], borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#00d4ff', pointBorderColor: 'white', pointRadius: 4, pointHoverRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: 'white' } }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(0)} Ar` } } }, scales: { y: { ticks: { color: 'white', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white', font: { size: 10 } }, grid: { display: false } } } } });
        return;
    }
    const sortedData = [...evolutionData].sort((a, b) => a.period.localeCompare(b.period));
    const labels = sortedData.map(d => { const [year, month] = d.period.split('-'); const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']; return `${monthNames[parseInt(month) - 1]} ${year}`; });
    const values = sortedData.map(d => d.total);
    if (evolutionChart) evolutionChart.destroy();
    evolutionChart = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Charges totales (Ar)', data: values, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', fill: true, tension: 0.4, pointBackgroundColor: '#00d4ff', pointBorderColor: 'white', pointRadius: 4, pointHoverRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: 'white' } }, tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(0)} Ar` } } }, scales: { y: { beginAtZero: true, ticks: { color: 'white', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white', font: { size: 10 } }, grid: { display: false } } } } });
}

function refreshEvolutionChart() { updateEvolutionChart(); showNotification('Graphique actualisé', 'success'); }
function refreshChart(type) { updateCharts(); showNotification('Graphique actualisé', 'success'); }

// ========================================
// TRANCHES
// ========================================

function addElecTranche() { elecTrancheCounter++; electricityTranches.push({ id: elecTrancheCounter, min: 0, max: 100, price: 500 }); renderElecTranches(); }
function removeElecTranche(btn) { const trancheDiv = btn.closest('.tranche-item'); const id = parseInt(trancheDiv.dataset.id); electricityTranches = electricityTranches.filter(t => t.id !== id); renderElecTranches(); }
function renderElecTranches() {
    const container = document.getElementById('elecTranchesList');
    if (!container) return;
    container.innerHTML = '';
    electricityTranches.sort((a, b) => a.min - b.min);
    electricityTranches.forEach((tranche, index) => {
        const template = document.getElementById('elecTrancheTemplate');
        if (!template) return;
        const clone = template.cloneNode(true);
        clone.removeAttribute('id');
        clone.style.display = 'block';
        clone.dataset.id = tranche.id;
        const numberSpan = clone.querySelector('.tranche-number');
        if (numberSpan) numberSpan.textContent = index + 1;
        const minInput = clone.querySelector('.tranche-min');
        const maxInput = clone.querySelector('.tranche-max');
        const priceInput = clone.querySelector('.tranche-price');
        if (minInput) minInput.value = tranche.min;
        if (maxInput) maxInput.value = tranche.max === Infinity ? '' : tranche.max;
        if (priceInput) priceInput.value = tranche.price;
        if (minInput) minInput.onchange = () => updateElecTranche(tranche.id, 'min', parseFloat(minInput.value) || 0);
        if (maxInput) maxInput.onchange = () => updateElecTranche(tranche.id, 'max', parseFloat(maxInput.value) || Infinity);
        if (priceInput) priceInput.onchange = () => updateElecTranche(tranche.id, 'price', parseFloat(priceInput.value) || 0);
        container.appendChild(clone);
    });
}
function updateElecTranche(id, field, value) { const tranche = electricityTranches.find(t => t.id === id); if (tranche) { tranche[field] = value; electricityTranches.sort((a, b) => a.min - b.min); renderElecTranches(); } }
function addWaterTranche() { waterTrancheCounter++; waterTranches.push({ id: waterTrancheCounter, min: 0, max: 20, price: 2500 }); renderWaterTranches(); }
function removeWaterTranche(btn) { const trancheDiv = btn.closest('.tranche-item'); const id = parseInt(trancheDiv.dataset.id); waterTranches = waterTranches.filter(t => t.id !== id); renderWaterTranches(); }
function renderWaterTranches() {
    const container = document.getElementById('waterTranchesList');
    if (!container) return;
    container.innerHTML = '';
    waterTranches.sort((a, b) => a.min - b.min);
    waterTranches.forEach((tranche, index) => {
        const template = document.getElementById('waterTrancheTemplate');
        if (!template) return;
        const clone = template.cloneNode(true);
        clone.removeAttribute('id');
        clone.style.display = 'block';
        clone.dataset.id = tranche.id;
        const numberSpan = clone.querySelector('.tranche-number');
        if (numberSpan) numberSpan.textContent = index + 1;
        const minInput = clone.querySelector('.tranche-min');
        const maxInput = clone.querySelector('.tranche-max');
        const priceInput = clone.querySelector('.tranche-price');
        if (minInput) minInput.value = tranche.min;
        if (maxInput) maxInput.value = tranche.max === Infinity ? '' : tranche.max;
        if (priceInput) priceInput.value = tranche.price;
        if (minInput) minInput.onchange = () => updateWaterTranche(tranche.id, 'min', parseFloat(minInput.value) || 0);
        if (maxInput) maxInput.onchange = () => updateWaterTranche(tranche.id, 'max', parseFloat(maxInput.value) || Infinity);
        if (priceInput) priceInput.onchange = () => updateWaterTranche(tranche.id, 'price', parseFloat(priceInput.value) || 0);
        container.appendChild(clone);
    });
}
function updateWaterTranche(id, field, value) { const tranche = waterTranches.find(t => t.id === id); if (tranche) { tranche[field] = value; waterTranches.sort((a, b) => a.min - b.min); renderWaterTranches(); } }

// ========================================
// DÉPENSES COMMUNES
// ========================================

function addExpense(description, amount, date) { commonExpenses.push({ id: Date.now(), description, amount: parseFloat(amount), date: date || new Date().toISOString().split('T')[0], paidBy: null }); saveData(); updateExpensesList(); showNotification('Dépense ajoutée', 'success'); }
function deleteExpense(id) { if (confirm('Supprimer cette dépense ?')) { commonExpenses = commonExpenses.filter(e => e.id !== id); saveData(); updateExpensesList(); showNotification('Dépense supprimée', 'success'); } }
function calculateExpenseSharing() { const totalExpenses = commonExpenses.reduce((sum, e) => sum + e.amount, 0); const perPerson = totalExpenses / (persons.length || 1); return { totalExpenses, perPerson }; }
function updateExpensesList() {
    const container = document.getElementById('commonExpensesList');
    if (!container) return;
    if (commonExpenses.length === 0) { container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Aucune dépense commune enregistrée</p>'; return; }
    const { totalExpenses, perPerson } = calculateExpenseSharing();
    container.innerHTML = `<div style="background: rgba(0,212,255,0.08); padding: 12px; border-radius: 12px; margin-bottom: 15px; border: 1px solid rgba(0,212,255,0.2);"><div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color:rgba(255,255,255,0.85)">Total des dépenses :</span><strong style="color: #00d4ff;">${totalExpenses.toFixed(0)} Ar</strong></div><div style="display: flex; justify-content: space-between;"><span style="color:rgba(255,255,255,0.85)">Part par personne :</span><strong style="color:rgba(255,255,255,0.9)">${perPerson.toFixed(0)} Ar</strong></div></div><div style="max-height: 300px; overflow-y: auto;">${commonExpenses.map(expense => `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,212,255,0.2);"><div><div><strong>${escapeHtml(expense.description)}</strong></div><small style="color: rgba(255,255,255,0.5);">${expense.date}</small></div><div style="display: flex; align-items: center; gap: 12px;"><span style="color: #ff6b6b;">${expense.amount.toFixed(0)} Ar</span><button class="btn-icon delete" onclick="deleteExpense(${expense.id})" style="padding: 4px 8px;"><i class="fas fa-trash"></i></button></div></div>`).join('')}</div>`;
}
function showExpenseModal() { const description = prompt("Description de la dépense :"); if (!description) return; const amount = prompt("Montant (Ar) :"); if (!amount || isNaN(amount)) return; const date = prompt("Date (AAAA-MM-JJ) :", new Date().toISOString().split('T')[0]); addExpense(description, amount, date); }

// ========================================
// INVITÉS
// ========================================

function showGuestModal() {
    const modalHtml = `<div id="guestModal" class="modal"><div class="modal-content"><div class="modal-header"><h3><i class="fas fa-user-clock"></i> Gestion des invités</h3><span class="close" onclick="closeGuestModal()">&times;</span></div><div class="modal-body"><div id="guestsList"></div><button class="btn-glow" onclick="addGuest()" style="width: 100%; margin-top: 15px;"><i class="fas fa-plus"></i> Ajouter un invité</button></div></div></div>`;
    if (document.getElementById('guestModal')) document.getElementById('guestModal').remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    updateGuestsList();
    document.getElementById('guestModal').style.display = 'block';
}
function closeGuestModal() { const modal = document.getElementById('guestModal'); if (modal) modal.remove(); }
function addGuest() { const name = prompt("Nom de l'invité :"); if (!name) return; const days = parseInt(prompt("Nombre de jours de présence :", "7")); if (isNaN(days)) return; guests.push({ id: Date.now(), name, days, coefficient: days / 30 }); updateGuestsList(); showNotification(`Invité ${name} ajouté pour ${days} jours`, 'success'); }
function removeGuest(id) { if (confirm('Supprimer cet invité ?')) { guests = guests.filter(g => g.id !== id); updateGuestsList(); showNotification('Invité supprimé', 'success'); } }
function updateGuestsList() {
    const container = document.getElementById('guestsList');
    if (!container) return;
    if (guests.length === 0) { container.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">Aucun invité enregistré</p>'; return; }
    container.innerHTML = guests.map(guest => `<div class="person-card" style="margin-bottom: 10px;"><h3><i class="fas fa-user-clock"></i> ${escapeHtml(guest.name)}</h3><p><i class="fas fa-calendar"></i> Présence: ${guest.days} jours</p><p><i class="fas fa-chart-line"></i> Coefficient: ${(guest.coefficient * 100).toFixed(0)}%</p><div class="card-actions"><button class="btn-icon delete" onclick="removeGuest(${guest.id})"><i class="fas fa-trash"></i> Supprimer</button></div></div>`).join('');
}

// ========================================
// COMPTES VIRTUELS
// ========================================

function initVirtualAccounts() { persons.forEach(person => { if (!virtualAccounts[person.id]) virtualAccounts[person.id] = { balance: 0, transactions: [] }; }); }
function addTransaction(personId, amount, description) { if (!virtualAccounts[personId]) virtualAccounts[personId] = { balance: 0, transactions: [] }; virtualAccounts[personId].balance += amount; virtualAccounts[personId].transactions.unshift({ id: Date.now(), date: new Date().toISOString(), amount, description, type: amount > 0 ? 'credit' : 'debit' }); saveData(); updateBalanceDisplay(); }
function showBalanceModal() {
    const modalHtml = `<div id="balanceModal" class="modal"><div class="modal-content"><div class="modal-header"><h3><i class="fas fa-wallet"></i> Comptes virtuels</h3><span class="close" onclick="closeBalanceModal()">&times;</span></div><div class="modal-body" id="balanceList"></div></div></div>`;
    if (document.getElementById('balanceModal')) document.getElementById('balanceModal').remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    updateBalanceDisplay();
    document.getElementById('balanceModal').style.display = 'block';
}
function closeBalanceModal() { const modal = document.getElementById('balanceModal'); if (modal) modal.remove(); }
function updateBalanceDisplay() {
    const container = document.getElementById('balanceList');
    if (!container) return;
    const charges = getTotalCharges();
    container.innerHTML = `<div style="max-height: 500px; overflow-y: auto;">${persons.map(person => {
        const account = virtualAccounts[person.id] || { balance: 0, transactions: [] };
        const charge = charges.find(c => c.personId === person.id);
        const amountDue = charge ? charge.totalCost : 0;
        const netBalance = account.balance - amountDue;
        return `<div class="settings-card" style="margin-bottom: 20px;"><h3 style="color: #00d4ff; margin-bottom: 15px;"><i class="fas fa-user"></i> ${escapeHtml(person.name)}</h3><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;"><div><small>Solde actuel</small><p style="font-size: 20px; font-weight: bold; color: #51cf66;">${account.balance.toFixed(0)} Ar</p></div><div><small>À payer</small><p style="font-size: 20px; font-weight: bold; color: #ff6b6b;">${amountDue.toFixed(0)} Ar</p></div><div><small>Situation</small><p style="font-size: 20px; font-weight: bold; color: ${netBalance >= 0 ? '#51cf66' : '#ff6b6b'}">${netBalance >= 0 ? 'Créditeur' : 'Débiteur'} (${Math.abs(netBalance).toFixed(0)} Ar)</p></div></div><div style="margin-top: 15px;"><button class="btn-outline" onclick="showAddTransactionModal(${person.id}, '${escapeHtml(person.name)}')" style="width: 100%;"><i class="fas fa-plus"></i> Ajouter une transaction</button></div>${account.transactions.length > 0 ? `<div style="margin-top: 15px;"><small>Dernières transactions</small><div style="max-height: 150px; overflow-y: auto; margin-top: 8px;">${account.transactions.slice(0, 5).map(t => `<div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="font-size: 11px;">${new Date(t.date).toLocaleDateString()}</span><span style="font-size: 11px;">${t.description}</span><span style="color: ${t.amount > 0 ? '#51cf66' : '#ff6b6b'}; font-weight: bold;">${t.amount > 0 ? '+' : ''}${t.amount.toFixed(0)} Ar</span></div>`).join('')}</div></div>` : ''}</div>`;
    }).join('')}</div><div style="margin-top: 20px;"><button class="btn-glow" onclick="settleBalances()" style="width: 100%;"><i class="fas fa-hand-holding-usd"></i> Proposer un règlement</button></div>`;
}
function showAddTransactionModal(personId, personName) { const amount = prompt(`Montant pour ${personName} (Ar) :\nPositif = crédit, Négatif = débit`, "0"); if (amount === null) return; const numAmount = parseFloat(amount); if (isNaN(numAmount)) return; const description = prompt("Description de la transaction :", "Paiement facture"); if (!description) return; addTransaction(personId, numAmount, description); closeBalanceModal(); showBalanceModal(); }
function settleBalances() {
    const charges = getTotalCharges();
    const balances = persons.map(person => { const account = virtualAccounts[person.id] || { balance: 0 }; const charge = charges.find(c => c.personId === person.id); const amountDue = charge ? charge.totalCost : 0; return { id: person.id, name: person.name, netBalance: account.balance - amountDue }; });
    const creditors = balances.filter(b => b.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance);
    const debtors = balances.filter(b => b.netBalance < 0).sort((a, b) => a.netBalance - b.netBalance);
    if (creditors.length === 0 || debtors.length === 0) { showNotification('Tous les comptes sont équilibrés !', 'success'); return; }
    let settlementPlan = [], i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
        let debtor = debtors[i], creditor = creditors[j];
        let amount = Math.min(Math.abs(debtor.netBalance), creditor.netBalance);
        if (amount > 0) { settlementPlan.push({ from: debtor.name, to: creditor.name, amount }); debtor.netBalance += amount; creditor.netBalance -= amount; }
        if (debtor.netBalance >= 0) i++;
        if (creditor.netBalance <= 0) j++;
    }
    let message = "💰 Proposition de règlement :\n\n";
    settlementPlan.forEach(plan => { message += `${plan.from} doit payer ${plan.amount.toFixed(0)} Ar à ${plan.to}\n`; });
    alert(message);
}

// ========================================
// WIDGETS
// ========================================

function updateWidgets() { updateUpcomingDueWidget(); updatePendingPaymentsWidget(); updateBudgetRemainingWidget(); updateTopAppliancesWidget(); }
function updateUpcomingDueWidget() {
    const container = document.getElementById('upcomingDueWidget');
    if (!container) return;
    const period = document.getElementById('period').value;
    const [year, month] = period.split('-');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    container.innerHTML = `<div class="widget-item"><span class="label">Prochaine échéance</span><span class="value ${daysUntilDue <= 7 ? 'urgent' : ''}">${dueDate.toLocaleDateString('fr-FR')}</span></div><div class="widget-item"><span class="label">Jours restants</span><span class="value ${daysUntilDue <= 7 ? 'urgent' : ''}">${daysUntilDue} jour(s)</span></div><div class="widget-item"><span class="label">Période</span><span class="value">${monthNames[parseInt(month) - 1]} ${year}</span></div>`;
}
function updatePendingPaymentsWidget() {
    const container = document.getElementById('pendingPaymentsWidget');
    if (!container) return;
    const charges = getTotalCharges();
    const unpaid = charges.filter(c => { const statusSpan = document.getElementById(`status-${c.personId}`); return statusSpan && statusSpan.textContent === 'Non payé'; });
    const totalUnpaid = unpaid.reduce((sum, c) => sum + c.totalCost, 0);
    if (unpaid.length === 0) { container.innerHTML = '<div class="widget-item"><span class="label">✅ Tout est payé !</span></div>'; return; }
    container.innerHTML = `<div class="widget-item"><span class="label">Nombre de paiements</span><span class="value urgent">${unpaid.length}</span></div><div class="widget-item"><span class="label">Montant total dû</span><span class="value urgent">${totalUnpaid.toFixed(0)} Ar</span></div>${unpaid.slice(0, 3).map(c => `<div class="widget-item"><span class="label">${escapeHtml(c.personName)}</span><span class="value">${c.totalCost.toFixed(0)} Ar</span></div>`).join('')}${unpaid.length > 3 ? `<div class="widget-item"><span class="label">...</span><span class="value">+${unpaid.length - 3} autre(s)</span></div>` : ''}`;
}
function updateBudgetRemainingWidget() {
    const container = document.getElementById('budgetRemainingWidget');
    if (!container) return;
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    let estimatedBudget = 100000;
    if (evolutionData.length > 0) { const lastMonths = [...evolutionData].slice(-3); estimatedBudget = lastMonths.reduce((sum, m) => sum + m.total, 0) / lastMonths.length; }
    const remaining = estimatedBudget - total;
    const percent = estimatedBudget > 0 ? (total / estimatedBudget) * 100 : 0;
    container.innerHTML = `<div class="widget-item"><span class="label">Budget estimé</span><span class="value">${estimatedBudget.toFixed(0)} Ar</span></div><div class="widget-item"><span class="label">Dépenses actuelles</span><span class="value">${total.toFixed(0)} Ar</span></div><div class="widget-item"><span class="label">Reste</span><span class="value ${remaining < 0 ? 'urgent' : ''}">${remaining.toFixed(0)} Ar</span></div><div class="widget-progress"><div class="widget-progress-bar"><div class="widget-progress-fill" style="width: ${Math.min(percent, 100)}%"></div></div><small style="display: block; text-align: center; margin-top: 5px;">${percent.toFixed(1)}% utilisé</small></div>`;
}
function updateTopAppliancesWidget() {
    const container = document.getElementById('topAppliancesWidget');
    if (!container) return;
    const topAppliances = [...appliances].sort((a, b) => b.consumption - a.consumption).slice(0, 5);
    if (topAppliances.length === 0) { container.innerHTML = '<div class="widget-item"><span class="label">Aucun appareil enregistré</span></div>'; return; }
    container.innerHTML = topAppliances.map(app => `<div class="widget-item"><span class="label">${escapeHtml(app.name)}</span><span class="value">${app.consumption.toFixed(1)} kWh</span></div>`).join('');
}

// ========================================
// CALENDRIER
// ========================================

function renderCalendar() {
    const container = document.getElementById('calendarView');
    if (!container) return;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const period = document.getElementById('period').value;
    const [year, month] = period.split('-');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const dueDay = dueDate.getDate();
    let calendarHtml = `<div style="text-align: center; margin-bottom: 15px;"><h4 style="color: #00d4ff;">${monthNames[currentMonth]} ${currentYear}</h4></div><div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center;"><div style="color: #ff6b6b; padding: 8px;">D</div><div style="color: white; padding: 8px;">L</div><div style="color: white; padding: 8px;">M</div><div style="color: white; padding: 8px;">M</div><div style="color: white; padding: 8px;">J</div><div style="color: white; padding: 8px;">V</div><div style="color: white; padding: 8px;">S</div>`;
    for (let i = 0; i < startWeekday; i++) calendarHtml += `<div style="padding: 8px; opacity: 0.3;">-</div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const isDue = (day === dueDay);
        const isToday = (day === today.getDate() && currentMonth === today.getMonth());
        calendarHtml += `<div style="padding: 8px; border-radius: 8px; background: ${isDue ? 'rgba(0,212,255,0.2)' : 'transparent'}; border: ${isToday ? '1px solid #00d4ff' : 'none'}; cursor: pointer;" onclick="showDayDetails(${day})"><div style="font-weight: ${isDue ? 'bold' : 'normal'}; color: ${isDue ? '#00d4ff' : 'white'};">${day}</div>${isDue ? '<div style="font-size: 10px;">📅 Échéance</div>' : ''}</div>`;
    }
    calendarHtml += `</div>`;
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    calendarHtml += `<div style="margin-top: 20px; padding: 15px; background: rgba(0,212,255,0.1); border-radius: 12px;"><div style="display: flex; justify-content: space-between;"><span>📊 Total des charges</span><span style="color: #00d4ff; font-weight: bold;">${total.toFixed(0)} Ar</span></div><div style="display: flex; justify-content: space-between; margin-top: 8px;"><span>📅 Prochaine échéance</span><span>${dueDate.toLocaleDateString('fr-FR')}</span></div></div>`;
    container.innerHTML = calendarHtml;
}
function showDayDetails(day) {
    const period = document.getElementById('period').value;
    const [year, month] = period.split('-');
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    if (day === dueDate.getDate()) {
        const charges = getTotalCharges();
        const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
        let message = `📅 Échéance du ${dueDate.toLocaleDateString('fr-FR')}\n\nTotal des charges : ${total.toFixed(0)} Ar\n\nRépartition :\n`;
        charges.forEach(c => { message += `- ${c.personName}: ${c.totalCost.toFixed(0)} Ar\n`; });
        alert(message);
    } else { showNotification(`Aucun événement pour le ${day}`, 'info'); }
}
function refreshCalendar() { renderCalendar(); showNotification('Calendrier actualisé', 'success'); }

// ========================================
// PRÉVISION
// ========================================

function calculateForecast() {
    if (evolutionData.length < 2) return { hasData: false, message: "Données insuffisantes pour une prévision (minimum 2 mois)" };
    const lastMonths = [...evolutionData].slice(-3);
    const total = lastMonths.reduce((sum, m) => sum + m.total, 0);
    const average = total / lastMonths.length;
    const lastMonth = lastMonths[lastMonths.length - 1];
    const lastTotal = lastMonth.total;
    const variation = ((average - lastTotal) / lastTotal) * 100;
    const forecast = average;
    const trend = variation > 0 ? 'hausse' : (variation < 0 ? 'baisse' : 'stable');
    const trendColor = variation > 0 ? 'trend-up' : (variation < 0 ? 'trend-down' : '');
    const alertThreshold = 50000;
    const isHigh = forecast > alertThreshold;
    return { hasData: true, average, lastTotal, forecast, variation: Math.abs(variation).toFixed(1), trend, trendColor, isHigh, alertThreshold };
}
function updateForecast() {
    const container = document.getElementById('forecastContent');
    if (!container) return;
    const forecast = calculateForecast();
    if (!forecast.hasData) { container.innerHTML = `<div class="forecast-loading">${forecast.message}</div>`; return; }
    container.innerHTML = `<div class="forecast-stats"><div class="forecast-item"><div class="label">Moyenne des 3 derniers mois</div><div class="value">${forecast.average.toFixed(0)} Ar</div></div><div class="forecast-item"><div class="label">Prévision mois prochain</div><div class="value">${forecast.forecast.toFixed(0)} Ar</div><small class="${forecast.trendColor}">${forecast.trend === 'hausse' ? '⬆️' : (forecast.trend === 'baisse' ? '⬇️' : '➡️')} ${forecast.variation}%</small></div><div class="forecast-item"><div class="label">Dernier mois</div><div class="value">${forecast.lastTotal.toFixed(0)} Ar</div></div></div>${forecast.isHigh ? `<div class="forecast-warning"><i class="fas fa-exclamation-triangle"></i> Attention : La prévision dépasse ${forecast.alertThreshold.toFixed(0)} Ar. Pensez à réduire votre consommation !</div>` : ''}`;
}

// ========================================
// NOTIFICATIONS
// ========================================

function updateEmailList() {
    const container = document.getElementById('emailList');
    if (!container) return;
    const emails = persons.filter(p => p.email).map(p => p.email);
    if (emails.length === 0) container.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Aucun email renseigné dans les profils</p>';
    else container.innerHTML = emails.map(email => `<div style="background: rgba(0,212,255,0.1); padding: 5px 10px; border-radius: 8px; margin-bottom: 5px; color: rgba(255,255,255,0.85);"><i class="fas fa-envelope" style="color:#00d4ff;margin-right:6px"></i>${email}</div>`).join('');
}
function sendEmail(to, subject, body) {
    // Try EmailJS if available
    if (typeof emailjs !== 'undefined') {
        emailjs.send('service_mkuw7cf', 'template_jirama', {
            to_email: to,
            to_name: to,
            subject: subject,
            message: body,
            from_name: 'JIRAMA Charge Manager'
        }).then(function() {
            console.log('✅ Email envoyé à ' + to);
        }).catch(function(err) {
            console.warn('EmailJS error:', err);
        });
    } else {
        // Fallback: open mailto
        var mailtoLink = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        window.open(mailtoLink, '_blank');
    }
    return true;
}
function sendInvoiceByEmail() {
    if (!emailNotificationsEnabled) { showNotification('Les notifications email sont désactivées', 'info'); return; }
    const charges = getTotalCharges();
    const period = document.getElementById('period').value;
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [year, month] = period.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    const dueDate = new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('fr-FR');
    let sentCount = 0;
    charges.forEach(charge => {
        const person = persons.find(p => p.id === charge.personId);
        if (person && person.email) {
            const subject = `Facture des charges - ${monthName} ${year}`;
            const body = `Bonjour ${person.name},\n\nVoici le détail de votre facture pour la période ${monthName} ${year} :\n\nÉlectricité : ${charge.electricityCost.toFixed(0)} Ar\nEau : ${charge.waterCost.toFixed(0)} Ar\nTotal à payer : ${charge.totalCost.toFixed(0)} Ar\n\nMerci de régler avant le ${dueDate}\n\nCordialement,\nJIRAMA Charge Manager`;
            sendEmail(person.email, subject, body);
            sentCount++;
        }
    });
    if (sentCount > 0) showNotification(`${sentCount} facture(s) envoyée(s) par email !`, 'success');
    else showNotification('Aucun email valide trouvé dans les profils', 'warning');
}
function sendEmailTest() { const testEmail = prompt("Entrez une adresse email pour le test :"); if (testEmail && testEmail.includes('@')) { sendEmail(testEmail, "Test JIRAMA Charge Manager", "Ceci est un test de notification. Votre application fonctionne correctement !"); showNotification(`Email de test envoyé à ${testEmail}`, 'success'); } else { showNotification('Email invalide', 'error'); } }
function initEmailJS() { if (typeof emailjs !== 'undefined') { emailjs.init("service_mkuw7cf"); console.log("✅ EmailJS initialisé avec succès"); } else { console.log("⏳ EmailJS non chargé, attente..."); setTimeout(initEmailJS, 1000); } }
function checkPaymentReminders() {
    if (!paymentRemindersEnabled) return;
    const period = document.getElementById('period').value;
    const [year, month] = period.split('-');
    const currentDate = new Date();
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
    const daysUntilDue = Math.ceil((dueDate - currentDate) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= reminderDays && daysUntilDue > 0) {
        const charges = getTotalCharges();
        const unpaid = charges.filter(c => { const statusSpan = document.getElementById(`status-${c.personId}`); return statusSpan && statusSpan.textContent === 'Non payé'; });
        if (unpaid.length > 0) {
            unpaid.forEach(charge => {
                const person = persons.find(p => p.id === charge.personId);
                if (person && person.email) {
                    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                    const subject = `Rappel de paiement - Facture ${monthNames[parseInt(month) - 1]} ${year}`;
                    const body = `Bonjour ${person.name},\n\nCeci est un rappel : votre facture de ${charge.totalCost.toFixed(0)} Ar pour la période ${monthNames[parseInt(month) - 1]} ${year} arrive à échéance dans ${daysUntilDue} jour(s).\n\nMerci de régulariser votre paiement.\n\nCordialement,\nJIRAMA Charge Manager`;
                    sendEmail(person.email, subject, body);
                }
            });
            showNotification(`${unpaid.length} rappel(s) de paiement envoyé(s)`, 'info');
        }
    }
}
setInterval(checkPaymentReminders, 24 * 60 * 60 * 1000);

// ========================================
// CLOUD
// ========================================

function initGoogleAPI() {
    if (typeof gapi === 'undefined') { console.log("⏳ Google API non chargé, attente..."); setTimeout(initGoogleAPI, 1000); return; }
    gapi.load('client', () => {
        gapi.client.init({ apiKey: 'AIzaSyBtD4STn8dJAbfvmeJxsZuU4R4cMUPsow8', discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] }).then(() => { console.log('✅ Google API initialisé'); gapiInitialized = true; }).catch((error) => { console.error('❌ Erreur init Google API:', error); });
    });
    if (typeof google !== 'undefined' && google.accounts) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: '108986838801937638933', scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata', prompt: 'select_account', callback: (tokenResponse) => { gapiAccessToken = tokenResponse.access_token; console.log('✅ Authentification Google Drive réussie'); showNotification('Connecté à Google Drive avec succès !', 'success'); } });
    }
}
function signInToDrive() {
    if (tokenClient) { tokenClient.requestAccessToken(); }
    else { showNotification('Service Google non disponible, réessayez dans quelques secondes', 'info'); setTimeout(() => { if (tokenClient) tokenClient.requestAccessToken(); else showNotification('Impossible de se connecter à Google Drive', 'error'); }, 2000); }
}
function syncToCloud() {
    if (!gapiAccessToken) { showNotification('Veuillez vous connecter à Google Drive d\'abord', 'info'); signInToDrive(); return; }
    showNotification('Sauvegarde en cours...', 'info');
    const data = { exportDate: new Date().toISOString(), version: '3.0', persons, appliances, commonExpenses, evolutionData, guests, virtualAccounts, settings: { elecBillAmount, waterBillAmount, elecConsumption, waterConsumption, elecMethod, waterMethod, elecTranchesEnabled, waterTranchesEnabled, electricityTranches, waterTranches }, history };
    const fileName = `jirama_backup_${new Date().toISOString().split('T')[0]}.json`;
    const fileContent = JSON.stringify(data, null, 2);
    const blob = new Blob([fileContent], { type: 'application/json' });
    const metadata = { name: fileName, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Authorization': `Bearer ${gapiAccessToken}` }, body: form }).then(response => response.json()).then(result => {
        if (result.id) { lastSyncDate = new Date(); const lastSyncElem = document.getElementById('lastSync'); if (lastSyncElem) lastSyncElem.textContent = lastSyncDate.toLocaleString(); showNotification('Sauvegarde cloud effectuée avec succès !', 'success'); localStorage.setItem('jiramaCloudBackup', JSON.stringify(data)); }
        else throw new Error(result.error?.message || 'Erreur lors de la sauvegarde');
    }).catch(error => { console.error('Erreur de sauvegarde:', error); showNotification('Erreur lors de la sauvegarde cloud', 'error'); });
}
// ========================================
// EXPORT/IMPORT
// ========================================

function exportData() {
    if (persons.length === 0 && appliances.length === 0) { showNotification('Aucune donnée à exporter', 'error'); return; }
    const data = { exportDate: new Date().toISOString(), version: '3.0', persons, appliances, commonExpenses, evolutionData, guests, virtualAccounts, settings: { elecBillAmount, waterBillAmount, elecConsumption, waterConsumption, elecMethod, waterMethod, elecTranchesEnabled, waterTranchesEnabled, electricityTranches, waterTranches }, history };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jirama_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Données exportées avec succès !', 'success');
}
function importData() {
    const fileInput = document.getElementById('importFile');
    if (!fileInput) return;
    fileInput.click();
    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.persons !== undefined && importedData.appliances !== undefined) {
                    persons = importedData.persons || [];
                    appliances = importedData.appliances || [];
                    commonExpenses = importedData.commonExpenses || [];
                    evolutionData = importedData.evolutionData || [];
                    guests = importedData.guests || [];
                    virtualAccounts = importedData.virtualAccounts || {};
                    history = importedData.history || [];
                    if (importedData.settings) {
                        elecBillAmount = importedData.settings.elecBillAmount || 0;
                        waterBillAmount = importedData.settings.waterBillAmount || 0;
                        elecConsumption = importedData.settings.elecConsumption || 0;
                        waterConsumption = importedData.settings.waterConsumption || 0;
                        elecMethod = importedData.settings.elecMethod || 'basedOnBill';
                        waterMethod = importedData.settings.waterMethod || 'equitable';
                        elecTranchesEnabled = importedData.settings.elecTranchesEnabled || false;
                        waterTranchesEnabled = importedData.settings.waterTranchesEnabled || false;
                        electricityTranches = importedData.settings.electricityTranches || [];
                        waterTranches = importedData.settings.waterTranches || [];
                    }
                    if (electricityTranches.length === 0) initDefaultTranches();
                    if (waterTranches.length === 0) initDefaultTranches();
                    saveData();
                    updatePersonsList();
                    updateAppliancesList();
                    updateDashboard();
                    updateBilling();
                    updateHistory();
                    updateExpensesList();
                    updateEvolutionChart();
                    updateWidgets();
                    loadSettings();
                    showNotification('Import réussi ! Toutes les données ont été restaurées.', 'success');
                } else { showNotification('Fichier invalide : structure non reconnue', 'error'); }
            } catch (error) { showNotification('Erreur lors de l\'import : fichier JSON invalide', 'error'); console.error(error); }
            fileInput.value = '';
        };
        reader.readAsText(file);
    };
}
function exportToExcel() {
    if (persons.length === 0) { showNotification('Aucune donnée à exporter', 'error'); return; }
    const charges = getTotalCharges();
    const period = document.getElementById('period').value;
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [year, month] = period.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    const exportDate = new Date().toLocaleString('fr-FR');
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    const totalElec = charges.reduce((sum, c) => sum + c.electricityCost, 0);
    const totalWater = charges.reduce((sum, c) => sum + c.waterCost, 0);
    const htmlContent = `<html><head><meta charset="UTF-8"><title>Rapport JIRAMA - ${monthName} ${year}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;background:white}.header{background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);color:white;padding:20px;text-align:center;border-radius:10px;margin-bottom:20px}.header h1{margin:0;font-size:28px}.section-title{background:#00d4ff;color:#1e3c72;padding:10px 15px;margin:20px 0 10px;border-radius:8px;font-weight:bold;font-size:16px}table{width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:8px;overflow:hidden}th{background:#1e3c72;color:white;padding:10px;text-align:left}td{padding:8px 10px;border-bottom:1px solid #e0e0e0}.total-row{background:rgba(255,255,255,0.08);font-weight:bold}.amount{text-align:right}.info-cards{display:flex;gap:15px;margin-bottom:20px;flex-wrap:wrap}.info-card{background:linear-gradient(135deg,#f8f9fa,#e9ecef);border-radius:10px;padding:15px;flex:1;min-width:150px;border-left:4px solid #00d4ff}.info-card .value{font-size:24px;font-weight:bold;color:#00d4ff}.footer{margin-top:30px;padding:15px;text-align:center;background:#f8f9fa;border-radius:8px;font-size:11px;color:#6c757d}</style></head><body><div class="header"><h1>⚡ JIRAMA Charge Manager</h1><p>Rapport des charges d'électricité et d'eau</p><p><strong>Période : ${monthName} ${year}</strong> | Exporté le ${exportDate}</p></div><div class="info-cards"><div class="info-card"><h4>💰 TOTAL DES CHARGES</h4><div class="value">${total.toFixed(0)} Ar</div></div><div class="info-card"><h4>⚡ ÉLECTRICITÉ</h4><div class="value">${elecBillAmount.toFixed(0)} Ar</div><small>${elecConsumption} kWh</small></div><div class="info-card"><h4>💧 EAU</h4><div class="value">${waterBillAmount.toFixed(0)} Ar</div><small>${waterConsumption} m³</small></div><div class="info-card"><h4>👥 COLOCATAIRES</h4><div class="value">${persons.length}</div><small>personnes</small></div></div><div class="section-title">📊 RÉPARTITION DES CHARGES PAR COLOCATAIRE</div><table><thead><tr><th>Colocataire</th><th>⚡ Électricité (Ar)</th><th>💧 Eau (Ar)</th><th>💰 Total (Ar)</th><th>📊 Part</th></tr></thead><tbody>${charges.map(charge => { const percent = total > 0 ? ((charge.totalCost / total) * 100).toFixed(1) : 0; return `<tr><td><strong>${escapeHtml(charge.personName)}</strong></td><td class="amount">${charge.electricityCost.toFixed(0)} Ar</td><td class="amount">${charge.waterCost.toFixed(0)} Ar</td><td class="amount"><strong>${charge.totalCost.toFixed(0)} Ar</strong></td><td class="amount">${percent}%</td></tr>`; }).join('')}<tr class="total-row"><td><strong>TOTAL GÉNÉRAL</strong></td><td class="amount"><strong>${totalElec.toFixed(0)} Ar</strong></td><td class="amount"><strong>${totalWater.toFixed(0)} Ar</strong></td><td class="amount"><strong>${total.toFixed(0)} Ar</strong></td><td class="amount"><strong>100%</strong></td></tr></tbody></table><div class="section-title">🔌 DÉTAIL DES APPAREILS ÉLECTRIQUES</div>${appliances.length > 0 ? `<table><thead><tr><th>Appareil</th><th>Catégorie</th><th>Puissance (W)</th><th>Utilisation</th><th>Consommation (kWh)</th><th>Coût (Ar)</th><th>Type</th></tr></thead><tbody>${appliances.map(app => { const cost = calculateElectricityCost(app.consumption).toFixed(0); return `<tr><td><strong>${escapeHtml(app.name)}</strong></td><td>${app.category}</td><td class="amount">${app.power} W</td><td>${app.hoursPerDay}h/j × ${app.daysPerMonth}j</td><td class="amount">${app.consumption.toFixed(2)} kWh</td><td class="amount">${cost} Ar</td><td>${app.type === 'individual' ? '👤 Individuel' : '👥 Partagé'}</td></tr>`; }).join('')}<tr class="total-row"><td colspan="4"><strong>TOTAL</strong></td><td class="amount"><strong>${appliances.reduce((s, a) => s + a.consumption, 0).toFixed(2)} kWh</strong></td><td class="amount"><strong>${appliances.reduce((s, a) => s + calculateElectricityCost(a.consumption), 0).toFixed(0)} Ar</strong></td><td></td></tr></tbody></table>` : '<p>Aucun appareil enregistré</p>'}<div class="section-title">🛒 DÉPENSES COMMUNES</div>${commonExpenses && commonExpenses.length > 0 ? `<table><thead><tr><th>Description</th><th>Montant (Ar)</th><th>Date</th></tr></thead><tbody>${commonExpenses.map(expense => `<tr><td>${escapeHtml(expense.description)}</td><td class="amount"><strong>${expense.amount.toFixed(0)} Ar</strong></td><td>${expense.date}</td></tr>`).join('')}<tr class="total-row"><td><strong>TOTAL DÉPENSES</strong></td><td class="amount"><strong>${commonExpenses.reduce((s, e) => s + e.amount, 0).toFixed(0)} Ar</strong></td><td></td></tr></tbody></table>` : '<p>Aucune dépense commune enregistrée</p>'}<div class="section-title">👥 LISTE DES COLOCATAIRES</div><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Présence</th></tr></thead><tbody>${persons.map(person => `<tr><td><strong>${escapeHtml(person.name)}</strong></td><td>${person.email || 'Non renseigné'}</td><td>${person.phone || 'Non renseigné'}</td><td>${person.coefficient * 100}%</td></tr>`).join('')}</tbody></table><div class="section-title">⚙️ PARAMÈTRES DE CALCUL</div><tr><td width="250"><strong>Méthode électricité</strong></td><td>${elecMethod === 'basedOnBill' ? 'Basé sur la facture totale' : elecMethod === 'basedOnBillAndAppliances' ? 'Facture totale + appareils individuels' : 'Basé sur les appareils'}</td></tr><tr><td><strong>Méthode eau</strong></td><td>${waterMethod === 'equitable' ? 'Division équitable' : 'Basé sur consommation individuelle'}</td></tr><tr><td><strong>Tarifs électricité personnalisés</strong></td><td>${elecTranchesEnabled ? 'Activés ✅' : 'Désactivés ❌'}</td></tr><tr><td><strong>Tarifs eau personnalisés</strong></td><td>${waterTranchesEnabled ? 'Activés ✅' : 'Désactivés ❌'}</td></tr><div class="footer"><p>📄 Rapport généré automatiquement par JIRAMA Charge Manager v3.0</p><p>📞 Support: +261 34 30 000 30 | ✉️ support@jirama.mg | 🌐 www.jirama.mg</p></div></body></html>`;
    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", `rapport_JIRAMA_${monthName}_${year}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Export Excel réussi !', 'success');
}

// ========================================
// SCAN
// ========================================

let scanModal = null;
function openScanModal() {
    const modalHtml = `<div id="scanModal" class="modal"><div class="modal-content"><div class="modal-header"><h3><i class="fas fa-camera"></i> Scanner une facture JIRAMA</h3><span class="close" onclick="closeScanModal()">&times;</span></div><div class="modal-body"><div class="scan-area" onclick="document.getElementById('scanFile').click()"><i class="fas fa-cloud-upload-alt"></i><p>Cliquez pour sélectionner une photo de facture</p><small>Formats acceptés : JPG, PNG, PDF</small><input type="file" id="scanFile" accept="image/*,application/pdf" style="display: none;"></div><div id="scanPreview"></div><div id="scanResult" class="scan-result" style="display: none;"><h4><i class="fas fa-check-circle"></i> Informations détectées</h4><p><strong>Montant électricité :</strong> <span id="detectedElec">0 Ar</span></p><p><strong>Consommation élec :</strong> <span id="detectedKwh">0 kWh</span></p><p><strong>Montant eau :</strong> <span id="detectedWater">0 Ar</span></p><p><strong>Consommation eau :</strong> <span id="detectedM3">0 m³</span></p><button class="btn-glow" onclick="applyDetectedValues()" style="width: 100%; margin-top: 15px;"><i class="fas fa-check"></i> Appliquer ces valeurs</button></div></div></div></div>`;
    if (document.getElementById('scanModal')) document.getElementById('scanModal').remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    scanModal = document.getElementById('scanModal');
    scanModal.style.display = 'block';
    const fileInput = document.getElementById('scanFile');
    fileInput.onchange = function(e) { const file = e.target.files[0]; if (file) processImage(file); };
}
function closeScanModal() { if (scanModal) scanModal.remove(); }
// ========================================
// AUTHENTIFICATION
// ========================================

function checkAuth() {
    var saved = localStorage.getItem('currentUser');
    if (saved) {
        try { currentUser = JSON.parse(saved); updateUIForUser(); }
        catch(e) { localStorage.removeItem('currentUser'); showLoginModal(); }
    } else {
        showLoginModal();
    }
    // Wire submit button and Enter key
    var btn = document.getElementById('submitLogin');
    if (btn) btn.onclick = function(e) { e.preventDefault(); login(); };
    ['loginUsername','loginPassword'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.onkeydown = function(e) { if (e.key === 'Enter') login(); };
    });
}
function showLoginModal() {
    var modal = document.getElementById('loginModal');
    if (!modal) return;
    modal.style.display = 'flex';
    var err = document.getElementById('loginError');
    if (err) err.style.display = 'none';
    setTimeout(function() {
        var u = document.getElementById('loginUsername');
        if (u) u.focus();
    }, 150);
}
function login() {
    var username = (document.getElementById('loginUsername').value || '').trim();
    var password = document.getElementById('loginPassword').value || '';
    if (!username || !password) {
        showLoginFieldError('Veuillez remplir tous les champs');
        return;
    }
    var user = users.find(function(u) {
        return u.username === username || u.email === username;
    });
    if (user && user.password === password) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        var modal = document.getElementById('loginModal');
        if (modal) modal.style.display = 'none';
        updateUIForUser();
        if (user.role !== 'admin' && user.personId) {
            filterDataByPersonId(user.personId);
        }
        showNotification('Bienvenue ' + user.name + ' !', 'success');
    } else {
        showLoginFieldError('Identifiants incorrects');
    }
}

function showLoginFieldError(msg) {
    var el = document.getElementById('loginError');
    var msgEl = document.getElementById('loginErrorMsg');
    if (el) {
        if (msgEl) msgEl.textContent = msg || 'Erreur de connexion';
        el.style.display = 'flex';
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = 'shake 0.4s ease';
        setTimeout(function() { if (el) el.style.display = 'none'; }, 4000);
    } else {
        showNotification(msg, 'error');
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
    document.activeElement?.blur();
}

function filterDataByPersonId(personId) {
    // Ne montrer que la personne connectée
    persons = persons.filter(p => p.id === personId);
    updatePersonsList();
    
    // Ne montrer que les appareils assignés à cette personne
    appliances = appliances.filter(a => a.personId === personId || a.type === 'shared');
    updateAppliancesList();
    
    updateDashboard();
    updateBilling();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    loadData();
    updatePersonsList(); updateAppliancesList(); updateDashboard(); updateBilling();
    // Remove userInfo from header
    var ui = document.getElementById('userInfo');
    if (ui) ui.remove();
    showLoginModal();
    showNotification('Déconnexion réussie', 'success');
}
function updateUIForUser() {
    if (!currentUser) return;
    var headerStats = document.querySelector('.header-stats');
    if (headerStats && !document.getElementById('userInfo')) {
        var ui = document.createElement('div');
        ui.id = 'userInfo'; ui.className = 'header-stat';
        var ico = currentUser.role === 'admin' ? 'fa-shield-alt' : (currentUser.role === 'guest' ? 'fa-user-secret' : 'fa-user-circle');
        var lbl = currentUser.role === 'admin' ? 'Admin' : (currentUser.role === 'guest' ? 'Invité' : 'Utilisateur');
        ui.innerHTML = '<i class="fas ' + ico + '"></i><div class="stat-info"><span class="stat-label">' + lbl + '</span><span class="stat-value">' + escapeHtml(currentUser.name) + '</span></div><button onclick="logout()" style="background:none;border:none;color:white;cursor:pointer;margin-left:8px;font-size:14px"><i class="fas fa-sign-out-alt"></i></button>';
        headerStats.appendChild(ui);
    }
    if (currentUser.role === 'guest') return;
    if (currentUser.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = 'none'; });
        filterDataForUser();
    }
}
function filterDataForUser() { if (currentUser.role === 'user') { const userPerson = persons.find(p => p.name === currentUser.name); if (userPerson) { persons = [userPerson]; } updatePersonsList(); } }
function addUser(username, password, name, role = 'user') { if (currentUser?.role !== 'admin') { showNotification('Accès non autorisé', 'error'); return; } const newUser = { id: users.length + 1, username, password, role, name }; users.push(newUser); showNotification(`Utilisateur ${username} créé avec succès`, 'success'); }
// ========================================
// GESTION DES COMPTES UTILISATEURS
// ========================================

// Afficher la liste des utilisateurs (dans les paramètres)
function showUsersManagement() {
    const modalHtml = `
        <div id="usersModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-users-cog"></i> Gestion des comptes</h3>
                    <span class="close" onclick="closeUsersModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div id="usersList"></div>
                    <button class="btn-glow" onclick="showAddUserForm()" style="width: 100%; margin-top: 15px;">
                        <i class="fas fa-plus"></i> Ajouter un utilisateur
                    </button>
                </div>
            </div>
        </div>
    `;
    
    if (document.getElementById('usersModal')) document.getElementById('usersModal').remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    updateUsersList();
    document.getElementById('usersModal').style.display = 'block';
}

function closeUsersModal() {
    const modal = document.getElementById('usersModal');
    if (modal) modal.remove();
}

function updateUsersList() {
    const container = document.getElementById('usersList');
    if (!container) return;
    
    container.innerHTML = `
        <div style="max-height: 400px; overflow-y: auto;">
            ${users.map(user => `
                <div class="settings-card" style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="color: #00d4ff;">${escapeHtml(user.name)}</h4>
                        <span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}">${user.role === 'admin' ? 'Admin' : 'Utilisateur'}</span>
                    </div>
                    <p><i class="fas fa-user"></i> Nom d'utilisateur: <strong>${escapeHtml(user.username)}</strong></p>
                    <p><i class="fas fa-envelope"></i> Email: ${escapeHtml(user.email || 'Non renseigné')}</p>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="btn-outline" onclick="resetUserPassword(${user.id})" style="flex: 1;">
                            <i class="fas fa-key"></i> Mot de passe
                        </button>
                        ${user.role !== 'admin' ? `<button class="btn-icon delete" onclick="deleteUser(${user.id})" style="flex: 1;"><i class="fas fa-trash"></i> Supprimer</button>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function showAddUserForm() {
    const name = prompt("Nom complet de l'utilisateur :");
    if (!name) return;
    const email = prompt("Email :");
    if (!email) return;
    const username = prompt("Nom d'utilisateur :", name.toLowerCase().replace(/\s/g, ''));
    if (!username) return;
    const password = prompt("Mot de passe :", "jirama123");
    if (!password) return;
    const role = confirm("Donner les droits d'administrateur ?") ? 'admin' : 'user';
    
    // Chercher si la personne existe déjà
    let personId = null;
    const existingPerson = persons.find(p => p.email === email);
    if (existingPerson) {
        personId = existingPerson.id;
    } else {
        // Créer une nouvelle personne
        const newPerson = {
            id: Date.now(),
            name: name,
            email: email,
            phone: '',
            coefficient: 1
        };
        persons.push(newPerson);
        personId = newPerson.id;
        updatePersonsList();
        saveData();
    }
    
    users.push({
        id: users.length + 1,
        username: username,
        password: password,
        role: role,
        name: name,
        email: email,
        personId: personId
    });
    
    saveData();
    updateUsersList();
    showNotification(`Utilisateur ${username} créé avec succès`, 'success');
}

function resetUserPassword(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        const newPassword = prompt(`Nouveau mot de passe pour ${user.name} :`, "jirama123");
        if (newPassword) {
            user.password = newPassword;
            saveData();
            showNotification(`Mot de passe réinitialisé pour ${user.name}`, 'success');
        }
    }
}

function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user && confirm(`Supprimer le compte de ${user.name} ?`)) {
        users = users.filter(u => u.id !== userId);
        saveData();
        updateUsersList();
        showNotification(`Utilisateur ${user.name} supprimé`, 'success');
    }
}
// ========================================
// LIENS FOOTER
// ========================================

function showGuide() { document.getElementById('guideModal').style.display = 'block'; }
function closeGuideModal() { document.getElementById('guideModal').style.display = 'none'; }
function showSupport() { document.getElementById('supportModal').style.display = 'block'; }
function closeSupportModal() { document.getElementById('supportModal').style.display = 'none'; }
function showFAQ() { const modal = document.getElementById('faqModal'); if (modal) modal.style.display = 'block'; else console.error("Modal FAQ non trouvé"); }
function closeFAQModal() { document.getElementById('faqModal').style.display = 'none'; }
function showTarifs() { document.getElementById('tarifsModal').style.display = 'block'; }
function closeTarifsModal() { document.getElementById('tarifsModal').style.display = 'none'; }
function showLegal() { showNotification('📜 Mentions légales : Application développée pour la gestion des charges JIRAMA.', 'info'); }
function showPrivacy() { showNotification('🔒 Politique de confidentialité : Vos données sont stockées localement sur votre appareil.', 'info'); }
function showTerms() { showNotification('📋 Conditions Générales d\'Utilisation : Application gratuite pour usage personnel.', 'info'); }
function showCookies() { showNotification('🍪 Ce site utilise le stockage local pour sauvegarder vos données.', 'info'); }
function showAccessibility() { showNotification('♿ Accessibilité : L\'application est conçue pour être accessible à tous.', 'info'); }
function showMobileApp() { showNotification('📱 L\'application mobile sera bientôt disponible sur Play Store et App Store !', 'info'); }
function showWebApp() { showNotification('🌐 Vous utilisez déjà la version Web App !', 'info'); }
function showAPI() { showNotification('🔧 L\'API publique sera disponible prochainement pour les développeurs.', 'info'); }
function showDocumentation() { showNotification('📚 La documentation technique est disponible sur notre site web : docs.jirama.mg', 'info'); window.open('https://docs.jirama.mg', '_blank'); }
function reportBug() { const bugReport = prompt("Décrivez le bug que vous avez rencontré :"); if (bugReport) { showNotification('Merci ! Votre rapport a été envoyé à notre équipe technique.', 'success'); console.log('Bug reporté:', bugReport); } }
function suggestFeature() { const suggestion = prompt("Proposez une amélioration pour l'application :"); if (suggestion) { showNotification('Merci pour votre suggestion ! Elle sera étudiée par notre équipe.', 'success'); console.log('Suggestion:', suggestion); } }

// Initialisation FAQ Accordéon - Version simplifiée (sans génération dynamique)
function initFaqAccordion() {
    document.addEventListener('click', function(e) {
        var q = e.target.closest && e.target.closest('.faq-question');
        if (!q) return;
        e.preventDefault(); e.stopPropagation();
        var item = q.closest('.faq-item');
        if (!item) return;
        var list = item.closest('.faq-list');
        var siblings = list ? list.querySelectorAll('.faq-item') : [];
        [].forEach.call(siblings, function(o) { if (o !== item) o.classList.remove('active'); });
        item.classList.toggle('active');
    });
}
function handleResponsiveCharts() {
    window.addEventListener('resize', () => { if (elecChart) elecChart.resize(); if (appliancesChart) appliancesChart.resize(); if (budgetChart) budgetChart.resize(); if (evolutionChart) evolutionChart.resize(); });
}

function initOfflineMode() {
    window.addEventListener('online', () => { showNotification('Connexion rétablie ! Synchronisation...', 'success'); syncToCloud(); });
    window.addEventListener('offline', () => { showNotification('Mode hors ligne activé. Les données seront synchronisées automatiquement.', 'info'); });
    if (!navigator.onLine) showNotification('Mode hors ligne actif', 'info');
}

function showBudgetSimulator() {
    try {
        if (persons.length === 0) { 
            showNotification('Ajoutez des colocataires pour utiliser le simulateur', 'error'); 
            return; 
        }
        
        const modal = document.getElementById('budgetModal');
        if (!modal) {
            console.error("Modal budget non trouvé");
            alert("Erreur: modal budget manquante");
            return;
        }
        
        const charges = getTotalCharges();
        if (!charges || charges.length === 0) {
            alert("Aucune charge trouvée");
            return;
        }
        
        const total = charges.reduce((sum, c) => sum + (c.totalCost || 0), 0);
        if (total === 0) {
            alert("Aucune charge enregistrée");
            return;
        }
        
        const period = document.getElementById('period')?.value || new Date().toISOString().slice(0, 7);
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const [year, month] = period.split('-');
        const monthName = monthNames[parseInt(month) - 1];
        
        const simulatorHTML = `<div style="padding: 20px;"><h4 style="color: white;">Répartition du budget - ${monthName} ${year}</h4><canvas id="budgetChart" style="max-height: 300px; margin: 20px 0;"></canvas><div class="budget-details">${charges.map(charge => `<div style="margin: 10px 0; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 12px;"><strong style="color: #00d4ff;">${escapeHtml(charge.personName)}</strong><br><span style="color: white;">${((charge.totalCost / total) * 100).toFixed(1)}% du total</span><div style="background: rgba(255,255,255,0.2); height: 8px; border-radius: 4px; margin-top: 8px;"><div style="background: #00d4ff; width: ${((charge.totalCost / total) * 100)}%; height: 8px; border-radius: 4px;"></div></div></div>`).join('')}</div><div style="text-align: center; margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #00d4ff, #0099cc); border-radius: 12px;"><h4 style="margin: 0; color: white;">Budget total mensuel</h4><p style="font-size: 32px; font-weight: bold; margin: 10px 0 0; color: white;">${total.toFixed(0)} Ar</p></div></div>`;
        
        const budgetSimulatorDiv = document.getElementById('budgetSimulator');
        if (budgetSimulatorDiv) {
            budgetSimulatorDiv.innerHTML = simulatorHTML;
        } else {
            console.error("Element budgetSimulator non trouvé");
        }
        
        modal.style.display = 'block';
        
        setTimeout(() => {
            try {
                const ctx = document.getElementById('budgetChart');
                if (ctx && typeof Chart !== 'undefined') {
                    if (budgetChart) budgetChart.destroy();
                    budgetChart = new Chart(ctx, { 
                        type: 'pie', 
                        data: { 
                            labels: charges.map(c => c.personName), 
                            datasets: [{ 
                                data: charges.map(c => c.totalCost), 
                                backgroundColor: ['#00d4ff', '#0099cc', '#33ddff', '#66e6ff', '#99eeff', '#cceeff']
                            }] 
                        }, 
                        options: { 
                            responsive: true, 
                            maintainAspectRatio: true,
                            plugins: { 
                                legend: { position: 'bottom', labels: { color: 'white' } } 
                            } 
                        } 
                    });
                }
            } catch (chartError) {
                console.error("Erreur graphique:", chartError);
            }
        }, 100);
        
    } catch (error) {
        console.error("Erreur showBudgetSimulator:", error);
        alert("Erreur: " + error.message);
    }
}

function closeBudgetModal() { 
    try {
        const modal = document.getElementById('budgetModal');
        if (modal) modal.style.display = 'none';
        if (budgetChart) {
            budgetChart.destroy();
            budgetChart = null;
        }
    } catch (error) {
        console.error("Erreur closeBudgetModal:", error);
    }
}

function generateInvoice() {
    if (persons.length === 0) { showNotification('Ajoutez des colocataires avant de générer une facture', 'error'); return; }
    const charges = getTotalCharges();
    const total = charges.reduce((sum, c) => sum + c.totalCost, 0);
    const period = document.getElementById('period').value;
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const [year, month] = period.split('-');
    const monthName = monthNames[parseInt(month) - 1];
    const chargesWithPercent = charges.map(c => ({ ...c, percent: total > 0 ? (c.totalCost / total) * 100 : 0 }));
    const invoiceHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture JIRAMA - ${monthName} ${year}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter','Segoe UI',Arial,sans-serif;background:#f5f7fa;padding:30px}.invoice-container{max-width:1000px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,0.1);overflow:hidden}.invoice-header{background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);padding:30px;color:#fff;text-align:center}.invoice-title h1{font-size:28px;font-weight:700;margin:0 0 8px}.invoice-title p{font-size:14px;opacity:0.9;margin:0}.invoice-period{background:rgba(255,255,255,0.2);display:inline-block;padding:6px 16px;border-radius:30px;font-size:13px;margin-top:15px}.info-section{display:flex;gap:20px;padding:25px 30px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.info-card{flex:1;background:#fff;padding:18px 20px;border-radius:12px;border:1px solid #e9ecef}.info-card h3{color:#1e3c72;font-size:13px;text-transform:uppercase;margin-bottom:12px}.info-card p{margin:8px 0;color:#2c3e50;display:flex;justify-content:space-between;font-size:14px}.total-amount{font-size:22px;font-weight:700;color:#10b981;text-align:right}.table-section{padding:25px 30px}.table-section h3{color:#1e3c72;margin-bottom:15px;font-size:16px}.invoice-table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e9ecef}.invoice-table th{background:#1e3c72;color:#fff;padding:12px 15px;text-align:left;font-weight:600;font-size:13px}.invoice-table td{padding:12px 15px;border-bottom:1px solid #e9ecef;color:#2c3e50;font-size:13px}.total-row{background:rgba(255,255,255,0.08);font-weight:700}.amount{text-align:right}.progress-section{padding:0 30px 25px}.progress-section h3{color:#1e3c72;margin-bottom:15px;font-size:16px}.progress-item{margin-bottom:12px}.progress-label{display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px;color:#475569}.progress-bar-bg{background:#e2e8f0;border-radius:20px;height:8px;overflow:hidden}.progress-bar-fill{background:linear-gradient(90deg,#00d4ff,#0099cc);height:100%;border-radius:20px}.invoice-footer{background:#1e293b;padding:20px 30px;color:#94a3b8;text-align:center;font-size:11px}.footer-links{margin-top:10px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap}@media(max-width:640px){body{padding:15px}.info-section{flex-direction:column;padding:20px}.table-section{padding:20px;overflow-x:auto}.invoice-table{min-width:500px}}</style><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"></head><body><div class="invoice-container"><div class="invoice-header"><div class="invoice-title"><h1>JIRAMA Charge Manager</h1><p>Facture des charges d'électricité et d'eau</p><div class="invoice-period"><i class="fas fa-calendar-alt"></i> Période : ${monthName} ${year}</div></div></div><div class="info-section"><div class="info-card"><h3><i class="fas fa-charging-station"></i> Détails JIRAMA</h3><p><strong>Électricité :</strong> <span>${elecBillAmount.toFixed(0)} Ar</span></p><p><strong>Eau :</strong> <span>${waterBillAmount.toFixed(0)} Ar</span></p><p><strong>Total factures :</strong> <span class="total-amount">${(elecBillAmount + waterBillAmount).toFixed(0)} Ar</span></p></div><div class="info-card"><h3><i class="fas fa-info-circle"></i> Informations</h3><p><strong>Date d'émission :</strong> <span>${date}</span></p><p><strong>Nombre de colocataires :</strong> <span>${persons.length}</span></p><p><strong>Total des charges :</strong> <span class="total-amount">${total.toFixed(0)} Ar</span></p><p><strong>Date d'échéance :</strong> <span>${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('fr-FR')}</span></p></div></div><div class="table-section"><h3><i class="fas fa-users"></i> Répartition des charges par colocataire</h3><table class="invoice-table"><thead><tr><th>Colocataire</th><th>Électricité (Ar)</th><th>Eau (Ar)</th><th>Total (Ar)</th><th>Part</th></tr></thead><tbody>${chargesWithPercent.map(charge => `<tr><td><strong>${escapeHtml(charge.personName)}</strong></td><td class="amount">${charge.electricityCost.toFixed(0)} Ar</td><td class="amount">${charge.waterCost.toFixed(0)} Ar</td><td class="amount"><strong>${charge.totalCost.toFixed(0)} Ar</strong></td><td class="amount">${charge.percent.toFixed(1)}%</td></tr>`).join('')}<tr class="total-row"><td><strong>TOTAL</strong></td><td class="amount"><strong>${charges.reduce((sum,c)=>sum+c.electricityCost,0).toFixed(0)} Ar</strong></td><td class="amount"><strong>${charges.reduce((sum,c)=>sum+c.waterCost,0).toFixed(0)} Ar</strong></td><td class="amount"><strong>${total.toFixed(0)} Ar</strong></td><td class="amount"><strong>100%</strong></td></tr></tbody></table></div><div class="progress-section"><h3><i class="fas fa-chart-pie"></i> Répartition visuelle des charges</h3>${chargesWithPercent.map(charge => `<div class="progress-item"><div class="progress-label"><span>${escapeHtml(charge.personName)}</span><span>${charge.totalCost.toFixed(0)} Ar (${charge.percent.toFixed(1)}%)</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${charge.percent}%"></div></div></div>`).join('')}</div><div class="invoice-footer"><p>Facture générée automatiquement par JIRAMA Charge Manager</p><div class="footer-links"><span><i class="fas fa-phone"></i> +261 34 30 000 30</span><span><i class="fas fa-envelope"></i> support@jirama.mg</span><span><i class="fas fa-globe"></i> www.jirama.mg</span></div><p style="margin-top:12px;font-size:10px;">Merci de régler votre part avant la date d'échéance</p></div></div></body></html>`;
    const element = document.createElement('div');
    element.innerHTML = invoiceHTML;
    html2pdf().from(element).set({ margin: 0.3, filename: `facture_JIRAMA_${monthName}_${year}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, letterRendering: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait', compress: true } }).save();
    history.unshift({ date: new Date().toISOString(), period, type: 'facture', total });
    saveData();
    updateHistory();
    saveMonthlyData();
    showNotification('Facture générée avec succès !', 'success');
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    document.getElementById('period')?.addEventListener('change', (e) => { currentPeriod = e.target.value; updateDashboard(); updateBilling(); updateHeaderStats(); showNotification('Période changée avec succès', 'success'); });
    document.getElementById('personForm')?.addEventListener('submit', (e) => { e.preventDefault(); savePerson(); });
    document.getElementById('personCoefficientSlider')?.addEventListener('input', (e) => { document.getElementById('coefficientValue').textContent = Math.round(e.target.value * 100) + '%'; });
    document.getElementById('applianceForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveAppliance(); });
    document.getElementById('applianceType')?.addEventListener('change', (e) => { document.getElementById('personSelectGroup').style.display = e.target.value === 'individual' ? 'block' : 'none'; });
    document.getElementById('elecMethod')?.addEventListener('change', (e) => { elecMethod = e.target.value; updateBilling(); updateDashboard(); });
    document.getElementById('waterMethod')?.addEventListener('change', (e) => { waterMethod = e.target.value; updateBilling(); updateDashboard(); });
    document.getElementById('elecBillAmount')?.addEventListener('input', calculateActualPrices);
    document.getElementById('elecConsumption')?.addEventListener('input', calculateActualPrices);
    document.getElementById('waterBillAmount')?.addEventListener('input', calculateActualPrices);
    document.getElementById('waterConsumption')?.addEventListener('input', calculateActualPrices);
    document.getElementById('elecTranchesEnabled')?.addEventListener('change', () => renderElecTranches());
    document.getElementById('waterTranchesEnabled')?.addEventListener('change', () => renderWaterTranches());
}

function sendQuickMessage(event) { event.preventDefault(); const name = event.target.querySelector('input[type="text"]')?.value; const email = event.target.querySelector('input[type="email"]')?.value; const message = event.target.querySelector('textarea')?.value; if (name && email && message) { showNotification(`Merci ${name} ! Votre message a été envoyé.`, 'success'); event.target.reset(); } else { showNotification('Veuillez remplir tous les champs', 'error'); } }

// Exposer les fonctions globales
window.switchTab = switchTab;
window.showPersonModal = showPersonModal;
window.closePersonModal = closePersonModal;
window.deletePerson = deletePerson;
window.showApplianceModal = showApplianceModal;
window.closeApplianceModal = closeApplianceModal;
window.deleteAppliance = deleteAppliance;
window.importDefaultAppliances = importDefaultAppliances;
window.markAsPaid = markAsPaid;
window.generateInvoice = generateInvoice;
window.shareBill = shareBill;
window.saveSettings = saveSettings;
window.resetData = resetData;
window.clearHistory = clearHistory;
window.showBudgetSimulator = showBudgetSimulator;
window.closeBudgetModal = closeBudgetModal;
window.refreshChart = refreshChart;
window.exportData = exportData;
window.importData = importData;
window.refreshEvolutionChart = refreshEvolutionChart;
window.sendInvoiceByEmail = sendInvoiceByEmail;
window.sendEmailTest = sendEmailTest;
window.showExpenseModal = showExpenseModal;
window.showGuestModal = showGuestModal;
window.showBalanceModal = showBalanceModal;
window.syncToCloud = syncToCloud;
window.restoreFromCloud = restoreFromCloud;
window.signInToDrive = signInToDrive;
window.exportToExcel = exportToExcel;
window.openScanModal = openScanModal;
window.showGuide = showGuide;
window.closeGuideModal = closeGuideModal;
window.showSupport = showSupport;
window.closeSupportModal = closeSupportModal;
window.showFAQ = showFAQ;
window.closeFAQModal = closeFAQModal;
window.showTarifs = showTarifs;
window.closeTarifsModal = closeTarifsModal;
window.showLegal = showLegal;
window.showPrivacy = showPrivacy;
window.showTerms = showTerms;
window.showCookies = showCookies;
window.showAccessibility = showAccessibility;
window.showMobileApp = showMobileApp;
window.showWebApp = showWebApp;
window.showAPI = showAPI;
window.showDocumentation = showDocumentation;
window.reportBug = reportBug;
window.suggestFeature = suggestFeature;
window.refreshCalendar = refreshCalendar;
window.addElecTranche = addElecTranche;
window.removeElecTranche = removeElecTranche;
window.addWaterTranche = addWaterTranche;
window.removeWaterTranche = removeWaterTranche;
window.sendQuickMessage = sendQuickMessage;
window.showDayDetails = showDayDetails;


// ============================================================
// FONCTIONS NOUVELLES
// ============================================================
window.switchLoginTab = switchLoginTab;
window.fillDemo = fillDemo;
window.toggleLoginPass = toggleLoginPass;
window.loginAsGuest = loginAsGuest;
window.showDocModal = showDocModal;
window.login = login;
window.logout = logout;
window.showLoginFieldError = showLoginFieldError;

// Initialisation principale
document.addEventListener('DOMContentLoaded', () => {
    generatePeriodOptions();
    loadData();
    setupEventListeners();
    initTarifSections();
    updateDashboard();
    updatePersonsList();
    updateAppliancesList();
    updateBilling();
    updateHistory();
    updateHeaderStats();
    handleResponsiveCharts();
    initConsumptionPreview();
    initEmailJS();
    initGoogleAPI();
    // initTheme removed
    updateEmailList();
    initOfflineMode();
    initVirtualAccounts();
    renderCalendar();
    updateWidgets();
    updateForecast();
    checkAuth();
    initFaqAccordion();
    initCloudStorage();
    initSettingsAccordion();
    updateUsersListPreview();
    initCloudStorage();
});

window.onclick = function(event) {
    const personModal = document.getElementById('personModal');
    const applianceModal = document.getElementById('applianceModal');
    const budgetModal = document.getElementById('budgetModal');
    const guideModal = document.getElementById('guideModal');
    const supportModal = document.getElementById('supportModal');
    const tarifsModal = document.getElementById('tarifsModal');
    const faqModal = document.getElementById('faqModal');
    const scanModalEl = document.getElementById('scanModal');
    const guestModalEl = document.getElementById('guestModal');
    const balanceModalEl = document.getElementById('balanceModal');
    if (event.target === personModal) closePersonModal();
    if (event.target === applianceModal) closeApplianceModal();
    if (event.target === budgetModal) closeBudgetModal();
    if (event.target === guideModal) closeGuideModal();
    if (event.target === supportModal) closeSupportModal();
    if (event.target === tarifsModal) closeTarifsModal();
    if (event.target === faqModal) closeFAQModal();
    if (event.target === scanModalEl && scanModalEl) closeScanModal();
    if (event.target === guestModalEl && guestModalEl) closeGuestModal();
    if (event.target === balanceModalEl && balanceModalEl) closeBalanceModal();
};

// ========================================
// FONCTIONS MANQUANTES À AJOUTER À LA FIN DU FICHIER
// ========================================

// ========================================
// INDICATEUR DE CONNEXION
// ========================================

function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    
    if (navigator.onLine) {
        statusDiv.className = 'connection-status online';
        statusDiv.innerHTML = '<i class="fas fa-wifi"></i> Connecté - Données synchronisées';
        
        setTimeout(() => {
            if (statusDiv.className === 'connection-status online') {
                statusDiv.style.opacity = '0';
                setTimeout(() => {
                    if (statusDiv.className === 'connection-status online') {
                        statusDiv.style.display = 'none';
                        statusDiv.style.opacity = '1';
                    }
                }, 500);
            }
        }, 3000);
        
        statusDiv.style.display = 'block';
    } else {
        statusDiv.className = 'connection-status offline';
        statusDiv.innerHTML = '<i class="fas fa-plug"></i> Mode hors ligne - Modifications en attente de synchronisation';
        statusDiv.style.display = 'block';
    }
}

// ========================================
// GESTION DU WORKER
// ========================================

let calculationWorker = null;

function initWorker() {
    try {
        if (window.Worker) {
            calculationWorker = new Worker('worker.js');
            console.log('✅ Worker initialisé');
            
            calculationWorker.addEventListener('message', function(e) {
                const result = e.data;
                switch(result.type) {
                    case 'chargesResult':
                        console.log('✅ Charges calculées par le worker');
                        updateBillingWithWorkerResult(result.data);
                        break;
                    case 'forecastResult':
                        console.log('✅ Prévisions calculées par le worker');
                        updateForecastWithWorkerResult(result.data);
                        break;
                    case 'reportResult':
                        console.log('✅ Rapport généré par le worker');
                        displayWorkerReport(result.data);
                        break;
                    case 'trendsResult':
                        console.log('✅ Tendances calculées par le worker');
                        updateTrendsDisplay(result.data);
                        break;
                }
            });
            
            calculationWorker.addEventListener('error', function(e) {
                console.error('❌ Erreur worker:', e);
                showNotification('Erreur de calcul, veuillez réessayer', 'error');
            });
        } else {
            console.warn('⚠️ Les Web Workers ne sont pas supportés par ce navigateur');
        }
    } catch (error) {
        console.error("Erreur initWorker:", error);
    }
}

function calculateChargesWithWorker() {
    if (calculationWorker) {
        showLoadingSpinner();
        calculationWorker.postMessage({
            type: 'calculateCharges',
            persons: persons,
            appliances: appliances,
            pricePerKwh: actualPricePerKwh || 550
        });
    } else {
        const charges = calculateElectricityCharges();
        updateBillingWithWorkerResult(charges);
    }
}

function updateBillingWithWorkerResult(charges) {
    hideLoadingSpinner();
    const container = document.getElementById('billingDetails');
    if (container) {
        const total = charges.reduce((sum, c) => sum + c.total, 0);
        container.innerHTML = `
            <table class="billing-table">
                <thead>
                    <tr>
                        <th>Colocataire</th>
                        <th>Montant (Ar)</th>
                    </tr>
                </thead>
                <tbody>
                    ${charges.map(c => `
                        <tr>
                            <td><strong>${escapeHtml(c.personName)}</strong></td>
                            <td class="amount">${c.total.toFixed(0)} Ar</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td><strong>TOTAL</strong></td>
                        <td class="amount"><strong>${total.toFixed(0)} Ar</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
    }
}

function showLoadingSpinner() {
    let spinner = document.getElementById('workerSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'workerSpinner';
        spinner.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: rgba(0,0,0,0.8); padding: 20px 30px; border-radius: 15px; 
                        z-index: 10000; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                <p style="margin-top: 10px;">Calcul en cours...</p>
            </div>
        `;
        document.body.appendChild(spinner);
    }
    spinner.style.display = 'flex';
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('workerSpinner');
    if (spinner) spinner.style.display = 'none';
}

function updateForecastWithWorkerResult(data) {
    console.log("Mise à jour des prévisions:", data);
}

function displayWorkerReport(data) {
    console.log("Affichage du rapport:", data);
}

function updateTrendsDisplay(data) {
    console.log("Mise à jour des tendances:", data);
}

// ========================================
// LAZY LOADING
// ========================================

const lazyModules = {};  // modules non utilisés

const loadedModules = {};

async function loadModule(moduleName) {
    if (!lazyModules[moduleName]) {
        console.warn(`⚠️ Module ${moduleName} non trouvé`);
        return null;
    }
    if (loadedModules[moduleName]) return loadedModules[moduleName];
    console.log(`🔄 Chargement du module ${moduleName}...`);
    showModuleLoading(moduleName);
    try {
        const module = await lazyModules[moduleName].load();
        loadedModules[moduleName] = module;
        console.log(`✅ Module ${moduleName} chargé avec succès`);
        hideModuleLoading();
        return module;
    } catch (error) {
        console.error(`❌ Erreur chargement ${moduleName}:`, error);
        hideModuleLoading();
        showNotification(`Erreur de chargement: ${moduleName}`, 'error');
        return null;
    }
}

let loadingTimeout = null;

function showModuleLoading(moduleName) {
    let loader = document.getElementById('moduleLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'moduleLoader';
        loader.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; 
                        background: linear-gradient(135deg, #00d4ff, #0099cc);
                        padding: 12px 20px; border-radius: 50px;
                        z-index: 10000; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                        display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Chargement...</span>
            </div>
        `;
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => hideModuleLoading(), 5000);
}

function hideModuleLoading() {
    const loader = document.getElementById('moduleLoader');
    if (loader) loader.style.display = 'none';
    if (loadingTimeout) clearTimeout(loadingTimeout);
}

// ========================================
// FONCTIONS DE SCAN CORRIGÉES (VERSION SÉCURISÉE)
// ========================================

// Correction de la fonction processImage qui manquait
function processImage(file) {
    const preview = document.getElementById('scanPreview');
    if (!preview) return;
    
    const reader = new FileReader();
    reader.onload = function(e) { 
        preview.innerHTML = `<img src="${e.target.result}" class="scan-preview" alt="Facture scannée" style="max-width: 100%; margin-top: 15px;">`; 
        setTimeout(() => simulateOCR(), 1500); 
    };
    reader.onerror = function() {
        alert("Erreur lors de la lecture du fichier");
    };
    reader.readAsDataURL(file);
}

// Version sécurisée de simulateOCR
function simulateOCR() {
    try {
        const detectedData = { 
            elecAmount: Math.floor(Math.random() * 100000) + 20000, 
            elecKwh: Math.floor(Math.random() * 200) + 50, 
            waterAmount: Math.floor(Math.random() * 50000) + 10000, 
            waterM3: Math.floor(Math.random() * 30) + 5 
        };
        
        const elecSpan = document.getElementById('detectedElec');
        const kwhSpan = document.getElementById('detectedKwh');
        const waterSpan = document.getElementById('detectedWater');
        const m3Span = document.getElementById('detectedM3');
        const resultDiv = document.getElementById('scanResult');
        
        if (elecSpan) elecSpan.textContent = detectedData.elecAmount.toFixed(0) + ' Ar';
        if (kwhSpan) kwhSpan.textContent = detectedData.elecKwh + ' kWh';
        if (waterSpan) waterSpan.textContent = detectedData.waterAmount.toFixed(0) + ' Ar';
        if (m3Span) m3Span.textContent = detectedData.waterM3 + ' m³';
        if (resultDiv) resultDiv.style.display = 'block';
        
        window.tempScannedData = detectedData;
    } catch (error) {
        console.error("Erreur simulateOCR:", error);
    }
}

// Version sécurisée de applyDetectedValues
function applyDetectedValues() {
    try {
        if (window.tempScannedData) {
            const elecAmountInput = document.getElementById('elecBillAmount');
            const elecConsInput = document.getElementById('elecConsumption');
            const waterAmountInput = document.getElementById('waterBillAmount');
            const waterConsInput = document.getElementById('waterConsumption');
            
            if (elecAmountInput) elecAmountInput.value = window.tempScannedData.elecAmount;
            if (elecConsInput) elecConsInput.value = window.tempScannedData.elecKwh;
            if (waterAmountInput) waterAmountInput.value = window.tempScannedData.waterAmount;
            if (waterConsInput) waterConsInput.value = window.tempScannedData.waterM3;
            
            calculateActualPrices();
            showNotification('Valeurs appliquées avec succès !', 'success');
            closeScanModal();
            window.tempScannedData = null;
        } else {
            alert("Aucune donnée scannée à appliquer");
        }
    } catch (error) {
        console.error("Erreur applyDetectedValues:", error);
        alert("Erreur lors de l'application des valeurs");
    }
}

// ========================================
// INITIALISATION SUPPLÉMENTAIRE
// ========================================

// Initialiser le worker au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initWorker();
        updateConnectionStatus();
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);
    });
} else {
    initWorker();
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

// Exposer les fonctions supplémentaires
window.processImage = processImage;
window.simulateOCR = simulateOCR;
window.applyDetectedValues = applyDetectedValues;
window.updateConnectionStatus = updateConnectionStatus;
window.initWorker = initWorker;
window.calculateChargesWithWorker = calculateChargesWithWorker;

// ========================================
// FONCTIONS DE LIAISON AVEC LE CLOUD
// ========================================

// Sauvegarder dans le cloud
async function saveToCloud() {
    if (!cloudStorage.isSignedIn) {
        showNotification('Veuillez vous connecter à Google Drive d\'abord', 'info');
        await cloudStorage.signIn();
        return;
    }
    
    const data = {
        persons: persons,
        appliances: appliances,
        commonExpenses: commonExpenses,
        evolutionData: evolutionData,
        history: history,
        settings: {
            elecBillAmount,
            waterBillAmount,
            elecConsumption,
            waterConsumption,
            elecMethod,
            waterMethod,
            elecTranchesEnabled,
            waterTranchesEnabled,
            electricityTranches,
            waterTranches
        }
    };
    
    await cloudStorage.saveData(data);
}

// Restaurer depuis le cloud
async function restoreFromCloud() {
    const restoredData = await cloudStorage.restoreData();
    
    if (restoredData) {
        // Restaurer les données
        persons = restoredData.persons || [];
        appliances = restoredData.appliances || [];
        commonExpenses = restoredData.commonExpenses || [];
        evolutionData = restoredData.evolutionData || [];
        history = restoredData.history || [];
        
        if (restoredData.settings) {
            elecBillAmount = restoredData.settings.elecBillAmount || 0;
            waterBillAmount = restoredData.settings.waterBillAmount || 0;
            elecConsumption = restoredData.settings.elecConsumption || 0;
            waterConsumption = restoredData.settings.waterConsumption || 0;
            elecMethod = restoredData.settings.elecMethod || 'basedOnBill';
            waterMethod = restoredData.settings.waterMethod || 'equitable';
            elecTranchesEnabled = restoredData.settings.elecTranchesEnabled || false;
            waterTranchesEnabled = restoredData.settings.waterTranchesEnabled || false;
            electricityTranches = restoredData.settings.electricityTranches || [];
            waterTranches = restoredData.settings.waterTranches || [];
        }
        
        // Sauvegarder en local
        saveData();
        
        // Rafraîchir l'interface
        updatePersonsList();
        updateAppliancesList();
        updateDashboard();
        updateBilling();
        updateHistory();
        updateExpensesList();
        updateEvolutionChart();
        updateWidgets();
        loadSettings();
        
        showNotification('Données restaurées avec succès !', 'success');
    }
}

// Initialiser le cloud storage au chargement
async function initCloudStorage() {
    await cloudStorage.init();
    
    // Vérifier si l'utilisateur est déjà connecté
    if (cloudStorage.isSignedIn) {
        cloudStorage.updateUIAfterLogin();
    }
}

// Appeler dans le DOMContentLoaded
// Ajoutez cette ligne : initCloudStorage();

// ========================================
// ACCORDÉON DES PARAMÈTRES
// ========================================

function initSettingsAccordion() {
    var first = document.querySelector('.settings-accordion-item');
    if (first) first.classList.add('active');
    document.addEventListener('click', function(e) {
        var h = e.target.closest && e.target.closest('.settings-accordion-header');
        if (!h) return;
        var item = h.closest('.settings-accordion-item');
        if (!item) return;
        var wasOpen = item.classList.contains('active');
        document.querySelectorAll('.settings-accordion-item').forEach(function(i) {
            i.classList.remove('active');
        });
        if (!wasOpen) item.classList.add('active');
    });
}

// ========================================
// GESTION DES COMPTES UTILISATEURS - VERSION AMÉLIORÉE
// ========================================

function updateUsersListPreview() {
    const container = document.getElementById('usersListPreview');
    if (!container) return;
    
    if (!users || users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: rgba(255,255,255,0.5);">
                <i class="fas fa-users" style="font-size: 32px; margin-bottom: 10px; display: block;"></i>
                Aucun utilisateur enregistré
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-name">
                    <span>${escapeHtml(user.name)}</span>
                    <span class="user-username">@${escapeHtml(user.username)}</span>
                    <span class="user-role">${user.role === 'admin' ? 'Admin' : 'Utilisateur'}</span>
                </div>
                ${user.email ? `
                    <div class="user-email">
                        <i class="fas fa-envelope"></i>
                        <span>${escapeHtml(user.email)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="user-actions">
                <button class="btn-reset-password" onclick="resetUserPassword(${user.id})">
                    <i class="fas fa-key"></i> Réinitialiser
                </button>
                ${user.role !== 'admin' ? `
                    <button class="btn-delete-user" onclick="deleteUserAccount(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Fonction pour supprimer un compte utilisateur
function deleteUserAccount(userId) {
    const user = users.find(u => u.id === userId);
    if (user && confirm(`Supprimer définitivement le compte de ${user.name} ?`)) {
        users = users.filter(u => u.id !== userId);
        saveData();
        updateUsersListPreview();
        showNotification(`Compte de ${user.name} supprimé`, 'success');
    }
}

// ========================================
// GESTION UNIFIÉE DES ÉVÉNEMENTS POUR MOBILE
// ========================================



// ============================================================
// NOUVELLES FONCTIONS — LOGIN REDESIGN + DOCUMENTATION
// ============================================================

function switchLoginTab(tab) {
    var pL = document.getElementById('panelLogin');
    var pG = document.getElementById('panelGuest');
    var tL = document.getElementById('tabLogin');
    var tG = document.getElementById('tabGuest');
    if (pL) pL.style.display = tab === 'login' ? 'block' : 'none';
    if (pG) pG.style.display = tab === 'guest' ? 'block' : 'none';
    if (tL) tL.className = 'login-tab' + (tab === 'login' ? ' active' : '');
    if (tG) tG.className = 'login-tab' + (tab === 'guest' ? ' active' : '');
}

function fillDemo(u, p) {
    var ue = document.getElementById('loginUsername');
    var pe = document.getElementById('loginPassword');
    if (ue) ue.value = u;
    if (pe) pe.value = p;
}

function toggleLoginPass() {
    var inp = document.getElementById('loginPassword');
    var ico = document.getElementById('eyeIcon');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (ico) ico.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

function loginAsGuest() {
    currentUser = { id: 0, username: 'guest', role: 'guest', name: 'Invité' };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    var modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
    updateUIForUser();
    showNotification('Mode Invité activé', 'success');
}

function showDocModal() {
    var ex = document.getElementById('docModal');
    if (ex) { ex.style.display = 'flex'; return; }
    var div = document.createElement('div');
    div.id = 'docModal';
    div.className = 'modal';
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    div.innerHTML = '<div class="modal-content" style="max-width:600px">' +
        '<div class="modal-header"><h3><i class="fas fa-code"></i> Documentation technique</h3>' +
        '<span class="close" onclick="var m=document.getElementById(&quot;docModal&quot;);if(m)m.style.display=&quot;none&quot;">&times;</span></div>' +
        '<div class="modal-body">' +
        '<h4>Architecture</h4><p>PWA 100% client-side. Service Worker pour mode hors-ligne. LocalStorage + IndexedDB.</p>' +
        '<h4>Calcul des charges</h4><p>kWh = Puissance (W) x heures/jour x jours/mois / 1000. Repartition par coefficient de presence.</p>' +
        '<h4>Fichiers principaux</h4><p>index.html · style.css · script.js · database.js · cloud-storage.js · worker.js · sw.js</p>' +
        '<h4>Compatibilite</h4><p>Chrome 88+, Firefox 85+, Safari 14+, Edge 88+. Responsive mobile/tablette/desktop.</p>' +
        '</div></div>';
    div.addEventListener('click', function(e) { if (e.target === div) div.style.display = 'none'; });
    document.body.appendChild(div);
}

window.switchLoginTab = switchLoginTab;
window.fillDemo = fillDemo;
window.toggleLoginPass = toggleLoginPass;
window.loginAsGuest = loginAsGuest;
window.showDocModal = showDocModal;


// ── Footer accordion ──────────────────────────────────────
function switchJCM(btn, id) {
    document.querySelectorAll('.jcm-tab').forEach(function(b){ b.classList.remove('active'); });
    document.querySelectorAll('.jcm-panel').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById(id);
    if (panel) panel.classList.add('active');
}
window.switchJCM = switchJCM;
