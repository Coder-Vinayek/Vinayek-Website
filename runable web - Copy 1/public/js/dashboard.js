// Dashboard JavaScript

let users = [];

function showMessage(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Load users data
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '/';
                return;
            }
            throw new Error('Failed to load users');
        }
        
        users = await response.json();
        displayUsers();
        updateStats();
    } catch (error) {
        showMessage('Failed to load users: ' + error.message, 'error');
    }
}

// Display users in table
function displayUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                <select onchange="changeUserRole(${user.id}, this.value)" ${user.username === 'admin' ? 'disabled' : ''}>
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>${user.last_login ? formatDate(user.last_login) : 'Never'}</td>
            <td class="user-actions">
                ${user.username !== 'admin' ? 
                    `<button class="btn btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">Delete</button>` : 
                    '<span style="color: #999;">Protected</span>'
                }
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update statistics
function updateStats() {
    const totalUsers = users.length;
    const adminUsers = users.filter(user => user.role === 'admin').length;
    const regularUsers = totalUsers - adminUsers;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('adminUsers').textContent = adminUsers;
    document.getElementById('regularUsers').textContent = regularUsers;
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            loadUsers(); // Reload users list
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        showMessage('Failed to delete user: ' + error.message, 'error');
    }
}

// Change user role
async function changeUserRole(userId, newRole) {
    try {
        const response = await fetch(`/api/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: newRole })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            loadUsers(); // Reload users list
        } else {
            showMessage(result.message, 'error');
            loadUsers(); // Reload to reset the select value
        }
    } catch (error) {
        showMessage('Failed to update user role: ' + error.message, 'error');
        loadUsers(); // Reload to reset the select value
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    
    // Refresh button
    document.getElementById('refreshUsers').addEventListener('click', loadUsers);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
});

// Auto-refresh users every 30 seconds
setInterval(loadUsers, 30000);