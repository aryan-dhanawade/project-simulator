/**
 * SYSTEM DYNAMICS SIMULATION ENGINE
 * 
 * Models software project delivery with:
 * - Feedback loops (burnout → productivity → bugs → stability)
 * - Exponential relationships (tech debt compounds)
 * - Logistic growth (burnout saturation)
 * - Non-linear coupling effects
 * - Diminishing returns on team size
 */

class SimulationEngine {
    constructor(params = {}) {
        this.params = {
            teamSize: params.teamSize || 5,
            deadlinePressure: params.deadlinePressure || 50,
            meetingOverhead: params.meetingOverhead || 20,
            testCoverage: params.testCoverage || 40,
            techDebt: params.techDebt || 30,
            coupling: params.coupling || 50,
            ...params
        };
        
        // Simulation constants
        this.CONSTANTS = {
            MAX_BUGS_PER_MODULE: 10,
            MAX_TEAM_SIZE_BENEFIT: 12, // Diminishing returns above this
            BURNOUT_SATURATION: 100,
            BUG_SPREAD_BASE: 0.3,
            STABILITY_BUG_WEIGHT: 5,
            STABILITY_DEBT_WEIGHT: 0.3,
            STABILITY_BURNOUT_WEIGHT: 0.2
        };
    }

    /**
     * Core simulation step
     * Pure function: (state, params) → new state
     */
    step(state) {
        const newState = JSON.parse(JSON.stringify(state));
        
        // Update metrics in order (respecting dependencies)
        newState.productivity = this.calculateProductivity(newState);
        newState.burnout = this.calculateBurnout(newState);
        newState.modules = this.updateModules(newState);
        newState.stability = this.calculateStability(newState);
        newState.featuresCompleted += this.calculateFeaturesCompleted(newState);
        newState.week += 1;
        
        // Record history
        newState.history.push({
            week: newState.week,
            stability: newState.stability,
            burnout: newState.burnout,
            bugs: newState.modules.reduce((sum, m) => sum + m.bugs, 0),
            features: state.featuresCompleted,
            productivity: newState.productivity,
            techDebt: newState.techDebt || 0
        });
        
        return newState;
    }

    /**
     * PRODUCTIVITY CALCULATION
     * 
     * Factors:
     * - Team size (diminishing returns above 12)
     * - Meeting overhead (linear reduction)
     * - Burnout (exponential reduction via logistic curve)
     * - Technical debt (quadratic reduction)
     */
    calculateProductivity(state) {
        // 1. Team size benefit (diminishing returns)
        const { MAX_TEAM_SIZE_BENEFIT } = this.CONSTANTS;
        const teamBenefit = this.params.teamSize <= MAX_TEAM_SIZE_BENEFIT
            ? this.params.teamSize
            : MAX_TEAM_SIZE_BENEFIT + Math.sqrt(this.params.teamSize - MAX_TEAM_SIZE_BENEFIT);

        // 2. Meeting overhead (linear hit to available time)
        const meetingLoss = 1 - (this.params.meetingOverhead / 100);

        // 3. Burnout impact (logistic curve - productivity drops fast once burnout > 50%)
        const burnoutPenalty = 1 / (1 + Math.exp((state.burnout - 50) / 15));

        // 4. Tech debt impact (quadratic - compounds badly)
        const debtPenalty = Math.pow(1 - (this.params.techDebt / 100), 2);

        // 5. Deadline pressure (modest boost to short-term, but feedback loops damage it)
        const pressureBoost = 1 + (this.params.deadlinePressure / 100) * 0.3;

        const baseProductivity = teamBenefit * meetingLoss * pressureBoost;
        const adjustedProductivity = baseProductivity * burnoutPenalty * debtPenalty;

        return Math.max(0.1, Math.min(20, adjustedProductivity));
    }

    /**
     * BURNOUT CALCULATION
     * 
     * Logistic growth model: burnout increases with pressure,
     * decreases with team size and adequate rest (low deadline pressure)
     * 
     * Burnout saturates at 100% (team can't work harder)
     */
    calculateBurnout(state) {
        const { BURNOUT_SATURATION } = this.CONSTANTS;
        
        // Burnout growth rate (driven by pressure)
        const pressureMultiplier = (this.params.deadlinePressure / 100) * 8;
        
        // Burnout reduction (team adequacy + recovery time)
        const teamRecovery = Math.min(5, this.params.teamSize * 0.5);
        const restFactor = (100 - this.params.deadlinePressure) / 100;
        const recoveryRate = teamRecovery * restFactor;
        
        // Logistic growth: dB/dt = r*B*(1 - B/K)
        // Simplified: newBurnout = oldBurnout + growth - recovery
        const netGrowth = pressureMultiplier - recoveryRate;
        const newBurnout = state.burnout + netGrowth;
        
        // Saturate at BURNOUT_SATURATION
        return Math.max(0, Math.min(BURNOUT_SATURATION, newBurnout));
    }

    /**
     * MODULE STATE UPDATES
     * 
     * For each module:
     * 1. Generate new bugs (exponential with tech debt)
     * 2. Spread bugs via coupling
     * 3. Fix bugs (testing-driven)
     */
    updateModules(state) {
        const modules = state.modules.map(module => {
            // Store previous state
            const prevBugs = module.bugs;
            
            // 1. NEW BUG GENERATION (exponential with tech debt)
            const bugGenerationRate = Math.pow(this.params.techDebt / 100, 1.5) * 3;
            const newBugs = Math.random() < bugGenerationRate 
                ? Math.floor(Math.random() * 3) + 1 
                : 0;
            
            // 2. BUG SPREAD (from coupled modules)
            let spreadBugs = 0;
            state.modules.forEach(neighbor => {
                if (neighbor.id === module.id || neighbor.bugs === 0) return;
                
                // Check if coupled
                const coupled = this.isModuleCoupled(module.id, neighbor.id);
                if (!coupled) return;
                
                // Spread probability: non-linear with coupling & test coverage
                const couplingFactor = Math.pow(this.params.coupling / 100, 1.3);
                const testingFactor = Math.pow(1 - (this.params.testCoverage / 100), 1.5);
                const spreadChance = couplingFactor * testingFactor * this.CONSTANTS.BUG_SPREAD_BASE;
                
                if (Math.random() < spreadChance) {
                    spreadBugs += Math.ceil(neighbor.bugs * 0.4);
                }
            });
            
            // 3. BUG FIXING (testing-driven)
            const fixingRate = (this.params.testCoverage / 100) * (state.productivity / 10);
            const fixedBugs = Math.floor(fixingRate * 2);
            
            // 4. Net bugs (capped at MAX)
            const totalBugs = Math.max(0, 
                Math.min(
                    this.CONSTANTS.MAX_BUGS_PER_MODULE,
                    module.bugs + newBugs + spreadBugs - fixedBugs
                )
            );
            
            return {
                ...module,
                prevBugs: prevBugs,
                bugs: totalBugs
            };
        });
        
        return modules;
    }

    /**
     * STABILITY CALCULATION
     * 
     * Stability = f(bugs, tech debt, burnout)
     * 
     * Factors:
     * - Active bugs (immediate impact)
     * - Tech debt (long-term degradation)
     * - Team burnout (increases bugs indirectly)
     */
    calculateStability(state) {
        const totalBugs = state.modules.reduce((sum, m) => sum + m.bugs, 0);
        
        // Impact of bugs (each bug is -5% stability)
        const bugImpact = totalBugs * this.CONSTANTS.STABILITY_BUG_WEIGHT;
        
        // Impact of tech debt (each % of debt is -0.3% stability)
        const debtImpact = this.params.techDebt * this.CONSTANTS.STABILITY_DEBT_WEIGHT;
        
        // Impact of burnout (burned out team writes buggy code)
        const burnoutImpact = (state.burnout / 100) * this.CONSTANTS.STABILITY_BURNOUT_WEIGHT * 10;
        
        const newStability = Math.max(0, 100 - bugImpact - debtImpact - burnoutImpact);
        
        return newStability;
    }

    /**
     * FEATURES COMPLETED
     * 
     * Based on:
     * - Productivity (time available)
     * - Stability (less time fixing bugs = more time features)
     * - Testing cost (tests slow down feature development)
     */
    calculateFeaturesCompleted(state) {
        const baseFeatures = state.productivity * (state.stability / 100);
        
        // Testing has a cost: higher testing reduces feature velocity slightly
        const testingCost = 1 - (this.params.testCoverage / 100) * 0.15;
        
        return Math.max(0, Math.floor(baseFeatures * testingCost));
    }

    /**
     * TECH DEBT UPDATE
     * 
     * Tech debt increases with:
     * - Deadline pressure (cutting corners)
     * - High meeting overhead (no time to refactor)
     * 
     * Tech debt decreases with:
     * - Dedicated refactoring time
     * - Team adequacy (big teams can afford debt reduction)
     */
    updateTechDebt(currentDebt) {
        const debtIncrease = (this.params.deadlinePressure / 100) * 0.5 + 
                            (this.params.meetingOverhead / 100) * 0.3;
        
        // Assume 10% of sprint goes to debt reduction if team size > 5
        const debtReduction = this.params.teamSize > 5 ? 1 : 0.2;
        
        return Math.max(0, Math.min(100, currentDebt + debtIncrease - debtReduction));
    }

    /**
     * Check if two modules are coupled
     * This is a simplified check; expand with actual dependency graph
     */
    isModuleCoupled(moduleA, moduleB) {
        const coupledPairs = [
            ['auth', 'api'],
            ['api', 'payments'],
            ['api', 'database'],
            ['frontend', 'api'],
            ['auth', 'notifications'],
            ['database', 'analytics'],
            ['database', 'search'],
            ['payments', 'notifications'],
            ['api', 'search']
        ];
        
        return coupledPairs.some(pair => 
            (pair[0] === moduleA && pair[1] === moduleB) ||
            (pair[0] === moduleB && pair[1] === moduleA)
        );
    }

    /**
     * Initialize simulation state
     */
    createInitialState(modules) {
        return {
            week: 1,
            modules: modules.map(m => ({ ...m, bugs: 0, prevBugs: 0 })),
            stability: 100,
            burnout: 0,
            productivity: this.calculateProductivity({ burnout: 0, modules }),
            featuresCompleted: 0,
            techDebt: this.params.techDebt,
            history: []
        };
    }

    /**
     * Run full simulation to week 52
     */
    runFullSimulation(modules) {
        let state = this.createInitialState(modules);
        
        while (state.week < 52 && state.stability > 0) {
            state = this.step(state);
        }
        
        return state;
    }
}

// Export for use in HTML or Node
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationEngine;

}
