// Authentication JavaScript

function showMessage(message, type = 'error') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Login form handler
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };
        
       try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });
            
            const result = await response.json();
            
        //     if (response.ok) {
        //         showMessage(result.message, 'success');
        //         // Redirect based on user role
        //         if (result.user.role === 'admin') {
        //             setTimeout(() => {
        //                 window.location.href = '/dashboard';
        //             }, 1000);
        //         } else {
        //             showMessage('Regular users don\'t have dashboard access yet!', 'success');
        //         }
        //     } else {
        //         showMessage(result.message, 'error');
        //     }
        // } catch (error) {
        //     showMessage('Network error. Please try again.', 'error');
        // }


        if (response.ok) {
            // ── role‑based redirect ─────────────────
            if (result.user.role === 'admin') {
              window.location.href = '/dashboard';     // admin home
            } else {
              window.location.href = '/users';    // regular‑user page
            }
            // no further code needed here
          } else {
            showMessage(result.message, 'error');
          }
        } catch (err) {
          showMessage('Network error. Please try again.', 'error');
        }
      });
    }

// Register form handler
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password')
        };
        
        // Basic validation
        if (registerData.password.length < 6) {
            showMessage('Password must be at least 6 characters long', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showMessage(result.message + ' You can now login.', 'success');
                // Clear form
                e.target.reset();
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                showMessage(result.message, 'error');
            }
        } catch (error) {
            showMessage('Network error. Please try again.', 'error');
        }


    });
}

// Auto-fill demo credentials
if (document.getElementById('loginForm')) {
    // Add click handler for demo credentials
    document.addEventListener('click', (e) => {
        if (e.target.closest('.demo-credentials')) {
            document.getElementById('username').value = 'admin';
            document.getElementById('password').value = 'admin123';
        }
    });
}