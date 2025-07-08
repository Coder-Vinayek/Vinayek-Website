// Wallet Management Components
// Add these to your existing user pages
// Placeholder so the script loads

class WalletComponents {
    constructor(apiUrl = 'http://localhost:3001/api') {
        this.apiUrl = apiUrl;
        this.currentUserId = null; // Set this from your existing auth system
    }

    // Set current user (call this from your existing auth system)
    setCurrentUser(userId) {
        this.currentUserId = userId;
    }

    // Render wallet dashboard component
    

    async renderWalletDashboard(containerId) {
        const container = document.getElementById(containerId);
        
        try {
            const [wallet, transactions] = await Promise.all([
                this.fetchWallet(),
                this.fetchTransactions(20)
            ]);

            container.innerHTML = `
                <div class="wallet-dashboard">
                    <div class="wallet-balance-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
                        <h3>Current Balance</h3>
                        <h1 style="font-size: 3rem; margin: 20px 0;">$${wallet.balance.toFixed(2)}</h1>
                        <p>Available for tournament registrations</p>
                    </div>
                    
                    <div class="wallet-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div class="action-card" style="border: 1px solid #ddd; padding: 20px; border-radius: 10px; text-align: center;">
                            <h5>💰 Add Funds</h5>
                            <p>Deposit money to your wallet</p>
                            <button onclick="walletComponents.showDepositModal()" class="btn btn-success">Deposit</button>
                        </div>
                        <div class="action-card" style="border: 1px solid #ddd; padding: 20px; border-radius: 10px; text-align: center;">
                            <h5>💸 Withdraw</h5>
                            <p>Transfer to your bank account</p>
                            <button onclick="walletComponents.showWithdrawModal()" class="btn btn-warning">Withdraw</button>
                        </div>
                    </div>
                    
                    <div class="transaction-history">
                        <h3>Transaction History</h3>
                        ${this.renderTransactionHistory(transactions)}
                    </div>
                </div>
            `;

        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Error loading wallet: ${error.message}</div>`;
        }
    }

    // Render transaction history
    renderTransactionHistory(transactions) {
        if (transactions.length === 0) {
            return '<p>No transactions yet.</p>';
        }

        return `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions.map(transaction => `
                        <tr>
                            <td>${this.formatTransactionType(transaction.transaction_type)}</td>
                            <td class="${transaction.amount >= 0 ? 'text-success' : 'text-danger'}">
                                ${transaction.amount >= 0 ? '+' : ''}$${Math.abs(transaction.amount).toFixed(2)}
                            </td>
                            <td>${transaction.description}</td>
                            <td>${this.formatDate(transaction.created_at)}</td>
                            <td><span class="badge bg-success">${transaction.status.toUpperCase()}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Show deposit modal
    showDepositModal() {
        const modalHtml = `
            <div class="modal fade" id="depositModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add Funds to Wallet</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="depositForm">
                                <div class="mb-3">
                                    <label for="depositAmount" class="form-label">Amount ($)</label>
                                    <input type="number" class="form-control" id="depositAmount" min="1" step="0.01" required>
                                </div>
                                <div class="mb-3">
                                    <label for="paymentMethod" class="form-label">Payment Method</label>
                                    <select class="form-select" id="paymentMethod" required>
                                        <option value="">Select Payment Method</option>
                                        <option value="credit_card">Credit Card</option>
                                        <option value="paypal">PayPal</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="walletComponents.processDeposit()">Add Funds</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('depositModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('depositModal')).show();
    }

    // Show withdraw modal
    async showWithdrawModal() {
        const wallet = await this.fetchWallet();
        
        const modalHtml = `
            <div class="modal fade" id="withdrawModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Withdraw Funds</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="withdrawForm">
                                <div class="mb-3">
                                    <label for="withdrawAmount" class="form-label">Amount ($)</label>
                                    <input type="number" class="form-control" id="withdrawAmount" min="1" step="0.01" max="${wallet.balance}" required>
                                    <div class="form-text">Available: $${wallet.balance.toFixed(2)}</div>
                                </div>
                                <div class="mb-3">
                                    <label for="withdrawMethod" class="form-label">Withdrawal Method</label>
                                    <select class="form-select" id="withdrawMethod" required>
                                        <option value="">Select Method</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="paypal">PayPal</option>
                                    </select>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-warning" onclick="walletComponents.processWithdraw()">Withdraw</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('withdrawModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        new bootstrap.Modal(document.getElementById('withdrawModal')).show();
    }

    // Process deposit
    async processDeposit() {
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const paymentMethod = document.getElementById('paymentMethod').value;

        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (!paymentMethod) {
            alert('Please select a payment method');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/wallet/${this.currentUserId}/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
                    payment_method: paymentMethod,
                    external_transaction_id: 'demo_' + Date.now()
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Funds added successfully!');
                bootstrap.Modal.getInstance(document.getElementById('depositModal')).hide();
                this.refreshWallet();
            } else {
                alert('Deposit failed: ' + result.message);
            }
        } catch (error) {
            alert('Deposit failed: ' + error.message);
        }
    }

    // Process withdraw
    async processWithdraw() {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const withdrawMethod = document.getElementById('withdrawMethod').value;

        if (!amount || amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (!withdrawMethod) {
            alert('Please select a withdrawal method');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/wallet/${this.currentUserId}/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
                    withdrawal_method: withdrawMethod
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Withdrawal processed successfully!');
                bootstrap.Modal.getInstance(document.getElementById('withdrawModal')).hide();
                this.refreshWallet();
            } else {
                alert('Withdrawal failed: ' + result.message);
            }
        } catch (error) {
            alert('Withdrawal failed: ' + error.message);
        }
    }

    // API calls
    async fetchWallet() {
        if (!this.currentUserId) return { balance: 0 };
        const response = await fetch(`${this.apiUrl}/wallet/${this.currentUserId}`);
        if (!response.ok) throw new Error('Failed to fetch wallet');
        return response.json();
    }

    async fetchTransactions(limit = 50) {
        if (!this.currentUserId) return [];
        const response = await fetch(`${this.apiUrl}/wallet/${this.currentUserId}/transactions?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        return response.json();
    }

    // Utility functions
    refreshWallet() {
        // Find containers and re-render
        const containers = document.querySelectorAll('[data-wallet-dashboard]');
        containers.forEach(container => {
            this.renderWalletDashboard(container.id);
        });
    }

    formatTransactionType(type) {
        const types = {
            'deposit': 'Deposit',
            'withdrawal': 'Withdrawal',
            'tournament_fee': 'Tournament Fee',
            'prize_win': 'Prize Won',
            'refund': 'Refund'
        };
        return types[type] || type;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Global instance
const walletComponents = new WalletComponents();