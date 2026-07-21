import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  projectId: "link-checker-1784544272",
  appId: "1:833231168125:web:e0979db7312f214ba60714",
  storageBucket: "link-checker-1784544272.firebasestorage.app",
  apiKey: "AIzaSyDfMQDz_YM5zT6goo-8sZlKvx4y1hBYZTg",
  authDomain: "link-checker-1784544272.firebaseapp.com",
  messagingSenderId: "833231168125"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentToken = null;

document.addEventListener('DOMContentLoaded', () => {
    // Auth UI Elements
    const authContainer = document.getElementById('auth-container');
    const appDashboard = document.getElementById('app-dashboard');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const authError = document.getElementById('auth-error');
    const userEmailDisplay = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');

    // App UI Elements
    const form = document.getElementById('scan-form');
    const urlInput = document.getElementById('url');
    const concurrencyInput = document.getElementById('concurrency');
    const delayInput = document.getElementById('delay');
    const concurrencyVal = document.getElementById('concurrency-val');
    const delayVal = document.getElementById('delay-val');
    
    const scanBtn = document.getElementById('scan-btn');
    const btnText = scanBtn.querySelector('.btn-text');
    const loader = scanBtn.querySelector('.loader');
    
    const statusMessage = document.getElementById('status-message');
    const summaryCard = document.getElementById('summary-card');
    const resultsContainer = document.getElementById('results-container');
    const resultsBody = document.getElementById('results-body');
    
    const statTotal = document.getElementById('stat-total');
    const statAlive = document.getElementById('stat-alive');
    const statDead = document.getElementById('stat-dead');
    const statTime = document.getElementById('stat-time');

    let currentAlive = 0;
    let currentDead = 0;

    // --- Firebase Auth Logic ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.emailVerified) {
                authError.style.color = "var(--error)";
                authError.textContent = "Please verify your email address to access the dashboard.";
                signOut(auth);
                return;
            }
            // User is logged in and verified
            authContainer.classList.add('hidden');
            appDashboard.classList.remove('hidden');
            userEmailDisplay.textContent = user.email;
            currentToken = await user.getIdToken();
        } else {
            // User is logged out
            authContainer.classList.remove('hidden');
            appDashboard.classList.add('hidden');
            userEmailDisplay.textContent = '';
            currentToken = null;
        }
    });

    loginBtn.addEventListener('click', () => {
        authError.textContent = '';
        signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .catch((error) => { authError.textContent = error.message; });
    });

    registerBtn.addEventListener('click', () => {
        authError.style.color = "var(--error)";
        authError.textContent = '';
        createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .then((userCredential) => {
                sendEmailVerification(userCredential.user);
                authError.style.color = "var(--success)";
                authError.textContent = "Registration successful! We have sent a verification link to your email.";
            })
            .catch((error) => { authError.textContent = error.message; });
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error(error));
    });

    // --- Crawler Logic ---

    concurrencyInput.addEventListener('input', (e) => concurrencyVal.textContent = e.target.value);
    delayInput.addEventListener('input', (e) => delayVal.textContent = e.target.value);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = urlInput.value.trim();
        if (!url) return;

        // Force a token refresh just in case it expired while sitting on the page
        if (auth.currentUser) {
            currentToken = await auth.currentUser.getIdToken(true);
        }

        // Reset UI
        resultsBody.innerHTML = '';
        currentAlive = 0;
        currentDead = 0;
        statTotal.textContent = '0';
        statAlive.textContent = '0';
        statDead.textContent = '0';
        statTime.textContent = '-';
        
        summaryCard.classList.remove('hidden');
        resultsContainer.classList.remove('hidden');
        
        btnText.classList.add('hidden');
        loader.classList.remove('hidden');
        scanBtn.disabled = true;
        
        statusMessage.textContent = 'Connecting...';
        statusMessage.style.color = 'var(--accent-primary)';

        // Setup WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/scan`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            statusMessage.textContent = 'Starting scan...';
            // Send config AND Token
            ws.send(JSON.stringify({
                url: url,
                concurrency: concurrencyInput.value,
                delay: delayInput.value,
                token: currentToken
            }));
        };

        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            
            if (response.type === 'init') {
                statusMessage.textContent = response.data.message;
                statTotal.textContent = response.data.total_links;
            } 
            else if (response.type === 'progress') {
                const res = response.data;
                appendResultRow(res);
                
                if (res.is_alive) {
                    currentAlive++;
                    statAlive.textContent = currentAlive;
                } else {
                    currentDead++;
                    statDead.textContent = currentDead;
                }
            }
            else if (response.type === 'summary') {
                statusMessage.textContent = 'Scan Complete!';
                statusMessage.style.color = 'var(--success)';
                statTime.textContent = response.data.total_time_ms + 'ms';
                resetButton();
            }
            else if (response.type === 'error') {
                statusMessage.textContent = `Error: ${response.message}`;
                statusMessage.style.color = 'var(--error)';
                resetButton();
            }
        };

        ws.onerror = (error) => {
            statusMessage.textContent = 'WebSocket connection error.';
            statusMessage.style.color = 'var(--error)';
            resetButton();
        };

        ws.onclose = () => {
            resetButton();
        };
    });

    function appendResultRow(res) {
        const tr = document.createElement('tr');
        
        // Status Badge
        let badgeClass = '';
        let badgeText = '';
        if (res.is_alive) {
            badgeClass = 'badge-success';
            badgeText = `${res.status_code} OK`;
        } else if (res.error_message === 'Timeout') {
            badgeClass = 'badge-timeout';
            badgeText = 'TIMEOUT';
        } else {
            badgeClass = 'badge-error';
            badgeText = res.status_code ? `${res.status_code} ERROR` : 'ERROR';
        }

        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = `<span class="status-badge ${badgeClass}">${badgeText}</span>`;

        // Response Time
        const tdTime = document.createElement('td');
        tdTime.innerHTML = `<span class="ms-pill">${res.response_time_ms}ms</span>`;

        // URL
        const tdUrl = document.createElement('td');
        const a = document.createElement('a');
        a.href = res.target_url;
        a.target = '_blank';
        a.textContent = res.target_url;
        a.style.color = 'var(--accent-primary)';
        a.style.textDecoration = 'none';
        tdUrl.appendChild(a);

        // Error message
        const tdError = document.createElement('td');
        tdError.textContent = res.error_message || '-';
        if (res.error_message) tdError.style.color = 'var(--error)';

        tr.appendChild(tdStatus);
        tr.appendChild(tdTime);
        tr.appendChild(tdUrl);
        tr.appendChild(tdError);

        resultsBody.prepend(tr);
    }

    function resetButton() {
        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        scanBtn.disabled = false;
    }
});
