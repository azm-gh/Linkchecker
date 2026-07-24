import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  projectId: "link-checker-1784544272",
  appId: "1:833231168125:web:e0979db7312f214ba60714",
  storageBucket: "link-checker-1784544272.firebasestorage.app",
  apiKey: "AIzaSyDfMQDz_YM5zT6goo-8sZlKvx4y1hBYZTg",
  authDomain: "link-checker-1784544272.firebaseapp.com",
  messagingSenderId: "833231168125"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
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
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const authError = document.getElementById('auth-error');
    const userEmailDisplay = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Nav elements
    const navScannerBtn = document.getElementById('nav-scanner-btn');
    const navHistoryBtn = document.getElementById('nav-history-btn');
    const scannerView = document.getElementById('scanner-view');
    const historyView = document.getElementById('history-view');

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
    
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const historyBody = document.getElementById('history-body');

    let currentAlive = 0;
    let currentDead = 0;
    let currentScanResults = [];

    // --- Firebase Auth Logic ---

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.emailVerified) {
                // If they managed to bypass the login screen (e.g. cached JS), kick them out
                authContainer.classList.remove('hidden');
                appDashboard.classList.add('hidden');
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
        authError.style.color = "var(--error)";
        authError.textContent = '';
        signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .then((userCredential) => {
                if (!userCredential.user.emailVerified) {
                    sendEmailVerification(userCredential.user);
                    authError.style.color = "var(--error)";
                    authError.textContent = "You haven't verified your email! We just sent a new verification link to your inbox.";
                    signOut(auth);
                }
            })
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

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (!email) {
            authError.style.color = "var(--error)";
            authError.textContent = "Please enter your email address in the field above to reset your password.";
            return;
        }
        sendPasswordResetEmail(auth, email)
            .then(() => {
                authError.style.color = "var(--success)";
                authError.textContent = "Password reset email sent! Check your inbox.";
            })
            .catch((error) => { 
                authError.style.color = "var(--error)";
                authError.textContent = error.message; 
            });
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error(error));
    });

    // --- Navigation Logic ---
    navScannerBtn.addEventListener('click', () => {
        scannerView.classList.remove('hidden');
        historyView.classList.add('hidden');
        navScannerBtn.style.background = 'var(--accent-primary)';
        navScannerBtn.style.border = 'none';
        navHistoryBtn.style.background = 'rgba(255,255,255,0.1)';
        navHistoryBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    });

    navHistoryBtn.addEventListener('click', () => {
        scannerView.classList.add('hidden');
        historyView.classList.remove('hidden');
        navHistoryBtn.style.background = 'var(--accent-primary)';
        navHistoryBtn.style.border = 'none';
        navScannerBtn.style.background = 'rgba(255,255,255,0.1)';
        navScannerBtn.style.border = '1px solid rgba(255,255,255,0.2)';
        loadHistory();
    });

    async function loadHistory() {
        if (!currentToken) return;
        historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';
        try {
            const res = await fetch('/api/history', {
                headers: { 'Authorization': 'Bearer ' + currentToken }
            });
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            historyBody.innerHTML = '';
            if (!data.history || data.history.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No history found.</td></tr>';
                return;
            }
            data.history.forEach(scan => {
                const tr = document.createElement('tr');
                const date = new Date(scan.timestamp).toLocaleString();
                tr.innerHTML = `
                    <td>${date}</td>
                    <td><a href="${scan.source_url}" target="_blank" style="color:var(--accent-primary);">${scan.source_url}</a></td>
                    <td>${scan.total_scanned}</td>
                    <td style="color:var(--error); font-weight:bold;">${scan.dead_count}</td>
                    <td>${scan.total_time_ms}ms</td>
                `;
                historyBody.appendChild(tr);
            });
        } catch (e) {
            historyBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--error);">${e.message}</td></tr>`;
        }
    }

    // --- CSV Export Logic ---
    exportCsvBtn.addEventListener('click', () => {
        if (currentScanResults.length === 0) return;
        
        let csvContent = "Target URL,Status,Response Time (ms),Error\n";
        currentScanResults.forEach(r => {
            // Escape quotes and wrap in quotes for safety
            const url = `"${r.target_url.replace(/"/g, '""')}"`;
            const status = r.status_code || '';
            const error = r.error_message ? `"${r.error_message.replace(/"/g, '""')}"` : '';
            csvContent += `${url},${status},${r.response_time_ms},${error}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "scan_results.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
        currentScanResults = [];
        statTotal.textContent = '0';
        statAlive.textContent = '0';
        statDead.textContent = '0';
        statTime.textContent = '-';
        exportCsvBtn.classList.add('hidden');
        
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
                currentScanResults.push(res);
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
                exportCsvBtn.classList.remove('hidden');
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
