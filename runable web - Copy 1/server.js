require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./db');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();


const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET
console.log('Loaded secret:', JWT_SECRET);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(JWT_SECRET));
app.use(express.static('public'));
app.use('/components', express.static(path.join(__dirname, 'public', 'js', 'components')));

app.get('/api/session', (req, res) => {
    const token = req.signedCookies.token;
    if (!token) return res.status(401).json({ error: 'Not logged in' });
  
    try {
      const user = jwt.verify(token, JWT_SECRET);
      res.json({
        id: user.id,
        username: user.username,
        role: user.role
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

// Users (regular player) page
app.get('/users', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'users.html'));
});



// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.get('/dashboard', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = (req.signedCookies && req.signedCookies.token) || null;


    if (!token) {
        return res.redirect('/login');
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;                   
        next();                             
    } catch (err) {
        // 4.  Token is invalid or expired → log out the user
        res.clearCookie('token');           // remove the bad cookie
        return res.redirect('/login');      // back to login


        // jwt.verify(token, JWT_SECRET, (err, user) => {
        //     if (err) {
        //         return res.redirect('/');
        //     }
        //     req.user = user;
        //     next();
        // });
    }
}

// Register route
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ message: 'Username or email already exists' });
                    }
                    return res.status(500).json({ message: 'Database error' });
                }
                res.json({ message: 'User registered successfully' });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Login route
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user in database
        db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            async (err, user) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error' });
                }

                if (!user || !(await bcrypt.compare(password, user.password))) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }

                // Update last login
                db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

                // Create JWT token
                const token = jwt.sign(
                    { userId: user.id, username: user.username, role: user.role },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                // Set cookie
                res.cookie('token', token, {
                    httpOnly: true,
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    signed: true
                });

                res.json({
                    message: 'Login successful',
                    user: { username: user.username, role: user.role }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Logout route
app.post('/api/logout', (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.redirect('/login'); // redirect to login on logout
  });
  

// Deposit money
app.post('/api/wallet/deposit', authenticateToken, (req, res) => {
    const amt = Number(req.body.amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });
  
    db.run('UPDATE user_wallets SET balance = balance + ? WHERE user_id = ?',
      [amt, req.user.userId], err => {
        if (err) return res.status(500).json({ message: 'DB error' });
        db.run(`INSERT INTO wallet_transactions(user_id,transaction_type,amount,description,reference_id)
                VALUES(?, 'deposit', ?, 'Wallet deposit', 'dep_'+strftime('%s','now'))`,
                [req.user.userId, amt]);
        res.json({ newBalance: amt });
    });
  });
  
  // Withdraw money
  app.post('/api/wallet/withdraw', authenticateToken, (req, res) => {
    const amt = Number(req.body.amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });
  
    db.get('SELECT balance FROM user_wallets WHERE user_id = ?',
      [req.user.userId], (err,row)=>{
        if(err) return res.status(500).json({ message:'DB error'});
        if(!row || row.balance < amt)
          return res.status(400).json({ message:'Insufficient funds' });
  
        db.run('UPDATE user_wallets SET balance = balance - ? WHERE user_id = ?',
          [amt, req.user.userId]);
        db.run(`INSERT INTO wallet_transactions(user_id,transaction_type,amount,description,reference_id)
                VALUES(?, 'withdrawal', ?, 'Wallet withdrawal', 'wd_'+strftime('%s','now'))`,
                [req.user.userId, -amt]);
        res.json({ newBalance: row.balance - amt });
    });
  });

  

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    db.all(
        'SELECT id, username, email, role, created_at, last_login FROM users ORDER BY created_at DESC',
        (err, users) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.json(users);
        }
    );
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    });
});

// Update user role (admin only)
app.put('/api/users/:id/role', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const userId = req.params.id;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
    }

    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User role updated successfully' });
    });
});

// Initialize SQLite Database
const tournamentDb = new sqlite3.Database('tournament_system.db', (err) => {
    if (err) {
        console.error('Error opening tournament database:', err.message);
    } else {
        console.log('Connected to Tournament SQLite database');
        initializeTournamentDatabase();
    }
});


// Initialize database with schema
function initializeTournamentDatabase() {
    const fs = require('fs');
    const schema = fs.readFileSync('database_schema.sql', 'utf8');

    db.exec(schema, (err) => {
        if (err) {
            console.error('Error initializing tournament database:1', err.message);
        } else {
            console.log('Tournament database initialized successfully');
        }
    });
}


// ===============================
// TOURNAMENT API ENDPOINTS
// ===============================

// Get all tournaments
app.get('/api/tournaments', (req, res) => {
    const sql = `SELECT * FROM tournaments WHERE status != 'draft' ORDER BY start_date ASC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get tournament by ID
app.get('/api/tournaments/:id', (req, res) => {
    const sql = `SELECT * FROM tournaments WHERE id = ?`;

    db.get(sql, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row || {});
    });
});

// Register for tournament
app.post('/api/tournaments/:id/register', (req, res) => {
    const tournamentId = req.params.id;
    const { user_id } = req.body; // You'll get this from your existing auth system

    if (!user_id) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Get tournament details
        db.get('SELECT * FROM tournaments WHERE id = ?', [tournamentId], (err, tournament) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
            }

            if (!tournament || tournament.status !== 'open') {
                db.run('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Tournament not available for registration' });
            }

            // Check registration deadline
            if (new Date(tournament.registration_deadline) < new Date()) {
                db.run('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
            }

            // Check if user already registered
            db.get('SELECT id FROM tournament_registrations WHERE tournament_id = ? AND user_id = ?',
                [tournamentId, user_id], (err, existing) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    if (existing) {
                        db.run('ROLLBACK');
                        return res.status(400).json({ success: false, message: 'Already registered for this tournament' });
                    }

                    // Check max participants
                    if (tournament.max_participants) {
                        db.get('SELECT COUNT(*) as count FROM tournament_registrations WHERE tournament_id = ? AND status = "registered"',
                            [tournamentId], (err, countResult) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                if (countResult.count >= tournament.max_participants) {
                                    db.run('ROLLBACK');
                                    return res.status(400).json({ success: false, message: 'Tournament is full' });
                                }

                                processRegistration();
                            });
                    } else {
                        processRegistration();
                    }

                    function processRegistration() {
                        let transactionId = null;

                        // Check wallet balance if entry fee required
                        if (tournament.entry_fee > 0) {
                            db.get('SELECT balance FROM user_wallets WHERE user_id = ?', [user_id], (err, wallet) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                if (!wallet || wallet.balance < tournament.entry_fee) {
                                    db.run('ROLLBACK');
                                    return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
                                }

                                // Deduct entry fee
                                deductEntryFee();
                            });
                        } else {
                            // Free tournament
                            createRegistration();
                        }

                        function deductEntryFee() {
                            // Create transaction record
                            const transactionSql = `INSERT INTO wallet_transactions 
                            (user_id, transaction_type, amount, description, reference_id) 
                            VALUES (?, 'tournament_fee', ?, ?, ?)`;

                            db.run(transactionSql, [
                                user_id,
                                -tournament.entry_fee,
                                `Entry fee for tournament: ${tournament.name}`,
                                `tournament_${tournamentId}`
                            ], function (err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                transactionId = this.lastID;

                                // Update wallet balance
                                db.run('UPDATE user_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                                    [tournament.entry_fee, user_id], (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ success: false, message: err.message });
                                        }

                                        createRegistration();
                                    });
                            });
                        }

                        function createRegistration() {
                            const registrationSql = `INSERT INTO tournament_registrations 
                            (tournament_id, user_id, payment_status, transaction_id) 
                            VALUES (?, ?, ?, ?)`;

                            const paymentStatus = tournament.entry_fee > 0 ? 'paid' : 'free';

                            db.run(registrationSql, [tournamentId, user_id, paymentStatus, transactionId], function (err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                db.run('COMMIT', (err) => {
                                    if (err) {
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    res.json({
                                        success: true,
                                        registration_id: this.lastID,
                                        message: 'Successfully registered for tournament'
                                    });
                                });
                            });
                        }
                    }
                });
        });
    });
});

// Cancel tournament registration
app.delete('/api/tournaments/:id/register', (req, res) => {
    const tournamentId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Get registration details
        const sql = `SELECT tr.*, t.entry_fee, t.name as tournament_name 
                     FROM tournament_registrations tr 
                     JOIN tournaments t ON tr.tournament_id = t.id 
                     WHERE tr.tournament_id = ? AND tr.user_id = ? AND tr.status = 'registered'`;

        db.get(sql, [tournamentId, user_id], (err, registration) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
            }

            if (!registration) {
                db.run('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Registration not found' });
            }

            // Cancel registration
            db.run('UPDATE tournament_registrations SET status = "cancelled", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [registration.id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    // Refund if there was an entry fee
                    if (registration.entry_fee > 0 && registration.payment_status === 'paid') {
                        // Create refund transaction
                        db.run(`INSERT INTO wallet_transactions 
                            (user_id, transaction_type, amount, description, reference_id) 
                            VALUES (?, 'refund', ?, ?, ?)`,
                            [user_id, registration.entry_fee,
                                `Refund for cancelled tournament: ${registration.tournament_name}`,
                                `refund_tournament_${tournamentId}`], (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ success: false, message: err.message });
                                    }

                                    // Update wallet balance
                                    db.run('UPDATE user_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                                        [registration.entry_fee, user_id], (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ success: false, message: err.message });
                                            }

                                            db.run('COMMIT', (err) => {
                                                if (err) {
                                                    return res.status(500).json({ success: false, message: err.message });
                                                }

                                                res.json({ success: true, message: 'Registration cancelled successfully' });
                                            });
                                        });
                                });
                    } else {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                return res.status(500).json({ success: false, message: err.message });
                            }

                            res.json({ success: true, message: 'Registration cancelled successfully' });
                        });
                    }
                });
        });
    });
});

// Get user registrations
app.get('/api/user/:userId/registrations', (req, res) => {
    const sql = `SELECT tr.*, t.name, t.start_date, t.entry_fee, t.status as tournament_status 
                 FROM tournament_registrations tr 
                 JOIN tournaments t ON tr.tournament_id = t.id 
                 WHERE tr.user_id = ? 
                 ORDER BY tr.created_at DESC`;

    db.all(sql, [req.params.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// ===============================
// WALLET API ENDPOINTS
// ===============================

// Get wallet balance
app.get('/api/wallet/:userId', (req, res) => {
    const sql = `SELECT * FROM user_wallets WHERE user_id = ?`;

    db.get(sql, [req.params.userId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row) {
            // Create wallet if doesn't exist
            db.run('INSERT INTO user_wallets (user_id, balance) VALUES (?, 0.00)',
                [req.params.userId], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.json({ user_id: req.params.userId, balance: 0.00, created_at: new Date().toISOString() });
                });
        } else {
            res.json(row);
        }
    });
});

// Deposit funds
app.post('/api/wallet/:userId/deposit', (req, res) => {
    const userId = req.params.userId;
    const { amount, payment_method, external_transaction_id } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Create transaction record
        const transactionSql = `INSERT INTO wallet_transactions 
            (user_id, transaction_type, amount, description, reference_id) 
            VALUES (?, 'deposit', ?, ?, ?)`;

        db.run(transactionSql, [
            userId,
            amount,
            `Deposit via ${payment_method || 'unknown'}`,
            external_transaction_id || `deposit_${Date.now()}`
        ], function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
            }

            const transactionId = this.lastID;

            // Update or create wallet
            db.run(`INSERT INTO user_wallets (user_id, balance) VALUES (?, ?) 
                    ON CONFLICT(user_id) DO UPDATE SET 
                    balance = balance + ?, updated_at = CURRENT_TIMESTAMP`,
                [userId, amount, amount], (err) => {
                    if (err) {
                        // For older SQLite versions without UPSERT
                        db.run('UPDATE user_wallets SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                            [amount, userId], function (err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                if (this.changes === 0) {
                                    // Wallet doesn't exist, create it
                                    db.run('INSERT INTO user_wallets (user_id, balance) VALUES (?, ?)',
                                        [userId, amount], (err) => {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ success: false, message: err.message });
                                            }
                                            completeDeposit();
                                        });
                                } else {
                                    completeDeposit();
                                }
                            });
                    } else {
                        completeDeposit();
                    }

                    function completeDeposit() {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                return res.status(500).json({ success: false, message: err.message });
                            }

                            // Get new balance
                            db.get('SELECT balance FROM user_wallets WHERE user_id = ?', [userId], (err, wallet) => {
                                res.json({
                                    success: true,
                                    transaction_id: transactionId,
                                    new_balance: wallet ? wallet.balance : amount,
                                    message: 'Deposit successful'
                                });
                            });
                        });
                    }
                });
        });
    });
});

// Withdraw funds
app.post('/api/wallet/:userId/withdraw', (req, res) => {
    const userId = req.params.userId;
    const { amount, withdrawal_method } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Check balance
        db.get('SELECT balance FROM user_wallets WHERE user_id = ?', [userId], (err, wallet) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ success: false, message: err.message });
            }

            if (!wallet || wallet.balance < amount) {
                db.run('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }

            // Create transaction record
            db.run(`INSERT INTO wallet_transactions 
                    (user_id, transaction_type, amount, description, reference_id) 
                    VALUES (?, 'withdrawal', ?, ?, ?)`,
                [userId, -amount, `Withdrawal via ${withdrawal_method || 'unknown'}`, `withdrawal_${Date.now()}`],
                function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ success: false, message: err.message });
                    }

                    const transactionId = this.lastID;

                    // Update wallet balance
                    db.run('UPDATE user_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
                        [amount, userId], (err) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ success: false, message: err.message });
                            }

                            db.run('COMMIT', (err) => {
                                if (err) {
                                    return res.status(500).json({ success: false, message: err.message });
                                }

                                res.json({
                                    success: true,
                                    transaction_id: transactionId,
                                    new_balance: wallet.balance - amount,
                                    message: 'Withdrawal successful'
                                });
                            });
                        });
                });
        });
    });
});

// Get transaction history
app.get('/api/wallet/:userId/transactions', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const sql = `SELECT * FROM wallet_transactions 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`;

    db.all(sql, [req.params.userId, limit, offset], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// ===============================
// ADMIN API ENDPOINTS
// ===============================

// Get all tournaments (including drafts) for admin
app.get('/api/admin/tournaments', (req, res) => {
    const sql = `SELECT t.*, 
                 COUNT(tr.id) as current_participants 
                 FROM tournaments t 
                 LEFT JOIN tournament_registrations tr ON t.id = tr.tournament_id 
                 AND tr.status = 'registered'
                 GROUP BY t.id 
                 ORDER BY t.created_at DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create tournament (admin)
app.post('/api/admin/tournaments', (req, res) => {
    const { name, description, entry_fee, max_participants, start_date, end_date,
        registration_deadline, status, prize_pool, game_type, rules } = req.body;

    const sql = `INSERT INTO tournaments 
                 (name, description, entry_fee, max_participants, start_date, end_date, 
                  registration_deadline, status, prize_pool, game_type, rules) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [name, description, entry_fee || 0, max_participants, start_date, end_date,
        registration_deadline, status || 'open', prize_pool || 0, game_type, rules],
        function (err) {
            if (err) {
                res.status(500).json({ success: false, message: err.message });
                return;
            }

            res.json({
                success: true,
                tournament_id: this.lastID,
                message: 'Tournament created successfully'
            });
        });
});

// Get all registrations (admin)
app.get('/api/admin/registrations', (req, res) => {
    const tournamentId = req.query.tournament_id;

    let sql = `SELECT tr.*, t.name as tournament_name 
               FROM tournament_registrations tr 
               JOIN tournaments t ON tr.tournament_id = t.id`;
    let params = [];

    if (tournamentId) {
        sql += ` WHERE tr.tournament_id = ?`;
        params.push(tournamentId);
    }

    sql += ` ORDER BY tr.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Update tournament status (admin)
app.put('/api/admin/tournaments/:id/status', (req, res) => {
    const { status } = req.body;

    db.run('UPDATE tournaments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, req.params.id], function (err) {
            if (err) {
                res.status(500).json({ success: false, message: err.message });
                return;
            }

            res.json({ success: true, message: 'Status updated successfully' });
        });
});

// Get wallet statistics (admin)
app.get('/api/admin/wallet-stats', (req, res) => {
    const walletStatsSql = `SELECT 
                            COUNT(*) as total_wallets,
                            COALESCE(SUM(balance), 0) as total_balance,
                            COALESCE(AVG(balance), 0) as avg_balance,
                            COALESCE(MAX(balance), 0) as max_balance
                            FROM user_wallets`;

    const transactionStatsSql = `SELECT 
                                 transaction_type,
                                 COUNT(*) as count,
                                 COALESCE(SUM(amount), 0) as total_amount
                                 FROM wallet_transactions 
                                 WHERE status = 'completed'
                                 GROUP BY transaction_type`;

    db.get(walletStatsSql, [], (err, walletStats) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        db.all(transactionStatsSql, [], (err, transactionStats) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            res.json({
                wallet_stats: walletStats,
                transaction_stats: transactionStats
            });
        });
    });
});

// Get all transactions (admin)
app.get('/api/admin/transactions', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const sql = `SELECT * FROM wallet_transactions 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`;

    db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Database: tournament_system.db');
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});