// ========================================
// WORKER.JS - Calculs en arrière-plan
// ========================================

// Écouter les messages du script principal
self.addEventListener('message', function(e) {
    const data = e.data;
    
    switch(data.type) {
        case 'calculateCharges':
            const charges = calculateElectricityCharges(data.persons, data.appliances, data.pricePerKwh);
            self.postMessage({ type: 'chargesResult', data: charges });
            break;
            
        case 'calculateForecast':
            const forecast = calculateForecast(data.evolutionData);
            self.postMessage({ type: 'forecastResult', data: forecast });
            break;
            
        case 'generateReport':
            const report = generateReport(data.charges, data.period);
            self.postMessage({ type: 'reportResult', data: report });
            break;
            
        case 'calculateTrends':
            const trends = calculateTrends(data.evolutionData);
            self.postMessage({ type: 'trendsResult', data: trends });
            break;
    }
});

// ========================================
// FONCTIONS DE CALCUL (exécutées en arrière-plan)
// ========================================

function calculateElectricityCharges(persons, appliances, pricePerKwh) {
    console.log('🔧 Worker: Calcul des charges en cours...');
    
    const results = [];
    
    for (let person of persons) {
        let total = 0;
        const personAppliances = appliances.filter(a => a.personId === person.id);
        
        for (let appliance of personAppliances) {
            // Calcul de la consommation
            const consumption = (appliance.power * appliance.hoursPerDay * appliance.daysPerMonth) / 1000;
            total += consumption * pricePerKwh;
        }
        
        // Appareils partagés
        const sharedAppliances = appliances.filter(a => a.type === 'shared');
        for (let appliance of sharedAppliances) {
            const consumption = (appliance.power * appliance.hoursPerDay * appliance.daysPerMonth) / 1000;
            total += (consumption * pricePerKwh) / persons.length;
        }
        
        results.push({
            personId: person.id,
            personName: person.name,
            total: total
        });
    }
    
    return results;
}

function calculateForecast(evolutionData) {
    if (!evolutionData || evolutionData.length < 2) {
        return { hasData: false, message: "Données insuffisantes" };
    }
    
    const lastMonths = [...evolutionData].slice(-3);
    const average = lastMonths.reduce((sum, m) => sum + m.total, 0) / lastMonths.length;
    const lastTotal = lastMonths[lastMonths.length - 1].total;
    const variation = ((average - lastTotal) / lastTotal) * 100;
    
    return {
        hasData: true,
        average: average,
        lastTotal: lastTotal,
        forecast: average,
        variation: Math.abs(variation).toFixed(1),
        trend: variation > 0 ? 'hausse' : (variation < 0 ? 'baisse' : 'stable')
    };
}

function generateReport(charges, period) {
    const total = charges.reduce((sum, c) => sum + c.total, 0);
    const average = total / charges.length;
    
    return {
        period: period,
        date: new Date().toISOString(),
        charges: charges,
        total: total,
        average: average,
        highestCharge: charges.reduce((max, c) => c.total > max.total ? c : max, charges[0]),
        lowestCharge: charges.reduce((min, c) => c.total < min.total ? c : min, charges[0])
    };
}

function calculateTrends(evolutionData) {
    if (!evolutionData || evolutionData.length < 2) {
        return { hasData: false };
    }
    
    const sorted = [...evolutionData].sort((a, b) => a.period.localeCompare(b.period));
    const lastThree = sorted.slice(-3);
    const firstThree = sorted.slice(0, 3);
    
    const recentAverage = lastThree.reduce((sum, m) => sum + m.total, 0) / lastThree.length;
    const oldAverage = firstThree.reduce((sum, m) => sum + m.total, 0) / firstThree.length;
    const evolution = ((recentAverage - oldAverage) / oldAverage) * 100;
    
    return {
        hasData: true,
        evolution: evolution.toFixed(1),
        direction: evolution > 0 ? 'up' : (evolution < 0 ? 'down' : 'stable'),
        recentAverage: recentAverage,
        oldAverage: oldAverage
    };
}

console.log('✅ Worker chargé et prêt');
