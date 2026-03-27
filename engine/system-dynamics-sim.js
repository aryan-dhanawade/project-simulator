class SimulationEngine {
    constructor() {
        this.stocks = {};
        this.flows = {};
        this.parameters = {};
        this.initialized = false;
    }

    addStock(name, initialValue) {
        this.stocks[name] = initialValue;
    }

    addFlow(name, flowFunction) {
        this.flows[name] = flowFunction;
    }

    addParameter(name, value) {
        this.parameters[name] = value;
    }

    initialize() {
        this.initialized = true;
    }

    step(dt) {
        if (!this.initialized) {
            throw new Error('SimulationEngine must be initialized before stepping.');
        }

        for (const flow in this.flows) {
            const flowValue = this.flows[flow](this);
            const stockName = flow.split('Flow')[0];
            if (this.stocks[stockName] !== undefined) {
                this.stocks[stockName] += flowValue * dt;
            }
        }
    }

    getStockValue(name) {
        return this.stocks[name];
    }
}

module.exports = SimulationEngine;