// Tournament Registration Components
// Add these to your existing user pages
// Placeholder so the script loads
  
if (window.tournamentComponents) {
    // Already loaded
    return;
  }
  
class TournamentComponents {
    constructor(apiUrl = 'http://localhost:3001/api') {
        this.apiUrl = apiUrl;
        this.currentUserId = null; // Set this from your existing auth system
    }

    // Set current user (call this from your existing auth system)
    setCurrentUser(userId) {
        this.currentUserId = userId;
    }

    // Render tournament list component
  
    async renderTournamentList(containerId) {
        this.lastContainer = containerId;
        const container = document.getElementById(containerId);
        
        try {
            const [tournaments, userRegistrations, wallet] = await Promise.all([
                this.fetchTournaments(),
                this.fetchUserRegistrations(),
                this.fetchWallet()
            ]);

            container.innerHTML = `
                <div class="tournament-section">
                    <div class="wallet-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h5>💰 Wallet Balance: $${wallet.balance.toFixed(2)}</h5>
                        <button onclick="tournamentComponents.showDepositModal()" class="btn btn-primary btn-sm">Add Funds</button>
                    </div>
                    
                    <h3>Available Tournaments</h3>
                    <div class="tournaments-grid">
                        ${tournaments.map(tournament => this.renderTournamentCard(tournament, userRegistrations, wallet.balance)).join('')}
                    </div>
                    
                    <h3 style="margin-top: 40px;">My Registrations</h3>
                    <div class="my-registrations">
                        ${this.renderUserRegistrations(userRegistrations)}
                    </div>
                </div>
            `;

        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Error loading tournaments: ${error.message}</div>`;
        }
    }

    // Render individual tournament card
    renderTournamentCard(tournament, userRegistrations, walletBalance) {
        const isRegistered = userRegistrations.some(reg => 
            reg.tournament_id == tournament.id && reg.status === 'registered'
        );
        
        const isDeadlinePassed = new Date(tournament.registration_deadline) < new Date();
        const canRegister = tournament.status === 'open' && !isDeadlinePassed && !isRegistered;
        const hasEnoughBalance = tournament.entry_fee <= walletBalance;

        return `
            <div class="tournament-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <div class="tournament-header" style="margin-bottom: 15px;">
                    <h4>${tournament.name}</h4>
                    <span class="badge ${this.getStatusBadgeClass(tournament.status)}">${tournament.status.toUpperCase()}</span>
                </div>
                
                <div class="tournament-details">
                    <p>${tournament.description || 'No description available'}</p>
                    <div class="details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                        <div><strong>Game:</strong> ${tournament.game_type || 'General'}</div>
                        <div><strong>Entry Fee:</strong> ${tournament.entry_fee > 0 ? '$' + tournament.entry_fee : 'FREE'}</div>
                        <div><strong>Start Date:</strong> ${this.formatDate(tournament.start_date)}</div>
                        <div><strong>Deadline:</strong> ${this.formatDate(tournament.registration_deadline)}</div>
                        ${tournament.max_participants ? `<div><strong>Max Participants:</strong> ${tournament.max_participants}</div>` : ''}
                        ${tournament.prize_pool > 0 ? `<div><strong>Prize Pool:</strong> $${tournament.prize_pool}</div>` : ''}
                    </div>
                </div>
                
                <div class="tournament-actions" style="text-align: right; margin-top: 15px;">
                    ${this.renderRegistrationButton(tournament, isRegistered, canRegister, hasEnoughBalance)}
                </div>
            </div>
        `;
    }

    // Render registration button
    renderRegistrationButton(tournament, isRegistered, canRegister, hasEnoughBalance) {
        if (isRegistered) {
            return `
                <button class="btn btn-success btn-sm" disabled>✓ Registered</button>
                <button class="btn btn-outline-danger btn-sm" onclick="tournamentComponents.cancelRegistration(${tournament.id})">Cancel</button>
            `;
        }
        
        if (!canRegister) {
            return `<button class="btn btn-secondary btn-sm" disabled>Registration Closed</button>`;
        }
        
        if (!hasEnoughBalance && tournament.entry_fee > 0) {
            return `
                <button class="btn btn-warning btn-sm" disabled>Insufficient Balance</button>
                <button class="btn btn-primary btn-sm" onclick="tournamentComponents.showDepositModal()">Add Funds</button>
            `;
        }
        
        return `<button class="btn btn-success btn-sm" onclick="tournamentComponents.registerForTournament(${tournament.id})">Register Now</button>`;
    }

    // Render user registrations table
    renderUserRegistrations(registrations) {
        if (registrations.length === 0) {
            return '<p>No tournament registrations yet.</p>';
        }

        return `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Tournament</th>
                        <th>Entry Fee</th>
                        <th>Status</th>
                        <th>Registration Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${registrations.map(reg => `
                        <tr>
                            <td>${reg.name}</td>
                            <td>${reg.entry_fee > 0 ? '$' + reg.entry_fee : 'FREE'}</td>
                            <td><span class="badge ${this.getStatusBadgeClass(reg.status)}">${reg.status.toUpperCase()}</span></td>
                            <td>${this.formatDate(reg.registration_date)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Register for tournament
    async registerForTournament(tournamentId) {
        if (!this.currentUserId) {
            alert('Please log in to register for tournaments');
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/tournaments/${tournamentId}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.currentUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Registration successful!');
                this.refreshTournamentList();
            } else {
                alert('Registration failed: ' + result.message);
            }
        } catch (error) {
            alert('Registration failed: ' + error.message);
        }
    }

    // Cancel registration
    async cancelRegistration(tournamentId) {
        if (!confirm('Are you sure you want to cancel your registration?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/tournaments/${tournamentId}/register`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.currentUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Registration cancelled successfully!');
                this.refreshTournamentList();
            } else {
                alert('Cancellation failed: ' + result.message);
            }
        } catch (error) {
            alert('Cancellation failed: ' + error.message);
        }
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
                            <button type="button" class="btn btn-primary" onclick="tournamentComponents.processDeposit()">Add Funds</button>
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
                this.refreshTournamentList();
            } else {
                alert('Deposit failed: ' + result.message);
            }
        } catch (error) {
            alert('Deposit failed: ' + error.message);
        }
    }

    // API calls
    async fetchTournaments() {
        const response = await fetch(`${this.apiUrl}/tournaments`);
        if (!response.ok) throw new Error('Failed to fetch tournaments');
        return response.json();
    }

    async fetchUserRegistrations() {
        if (!this.currentUserId) return [];
        const response = await fetch(`${this.apiUrl}/user/${this.currentUserId}/registrations`);
        if (!response.ok) throw new Error('Failed to fetch registrations');
        return response.json();
    }

    async fetchWallet() {
        if (!this.currentUserId) return { balance: 0 };
        const response = await fetch(`${this.apiUrl}/wallet/${this.currentUserId}`);
        if (!response.ok) throw new Error('Failed to fetch wallet');
        return response.json();
    }

    // Utility functions
    refreshTournamentList() {
        // Find containers and re-render
        const containers = document.querySelectorAll('[data-tournament-list]');
        containers.forEach(container => {
            this.renderTournamentList(container.id);
        });
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

    getStatusBadgeClass(status) {
        const classes = {
            'open': 'bg-success',
            'closed': 'bg-danger',
            'ongoing': 'bg-warning',
            'completed': 'bg-secondary',
            'registered': 'bg-success',
            'cancelled': 'bg-secondary',
            'disqualified': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }
}

// Global instance
const tournamentComponents = new TournamentComponents();