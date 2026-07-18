document.addEventListener('DOMContentLoaded', () => {
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

    // Update slider values dynamically
    concurrencyInput.addEventListener('input', (e) => concurrencyVal.textContent = e.target.value);
    delayInput.addEventListener('input', (e) => delayVal.textContent = e.target.value);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const url = urlInput.value.trim();
        if (!url) return;

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
            // Send config
            ws.send(JSON.stringify({
                url: url,
                concurrency: concurrencyInput.value,
                delay: delayInput.value
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
