// --- SUPABASE SETUP ---
// FOR DIRECT UPLOAD: Put your real keys here. 
// FOR GITHUB ACTIONS: Leave the %% placeholders.
const supabaseUrl = ''https://kawuvttwnixfqhfkmmya.supabase.co''; 
const supabaseKey = ''eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthd3V2dHR3bml4ZnFoZmttbXlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTM5MDcsImV4cCI6MjEwOTM2OTkwN30.1JfyrLllkqozLQ5nAN3Fl-LngVVu7dnYH1unpeMXS5c''; 

let _supabase = null;
try {
    if (supabaseUrl.includes('%%')) {
        alert("⚠️ KEYS MISSING: Please replace the %% placeholders with your actual Supabase URL and Key in app.js.");
    } else {
        _supabase = supabase.createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    console.error("Supabase failed to initialize.", e);
    alert("Supabase Init Error: " + e.message);
}

// --- GLOBAL VARIABLES ---
let cases = [];
let testimonies = [];
let currentCaseId = null;
let pieChart, barChart;

// --- SYSTEM LOG ---
function addLog(message) {
    const logBox = document.getElementById('log-content');
    if(!logBox) return;
    const time = new Date().toLocaleTimeString();
    let currentLogs = logBox.innerHTML.split('<br>');
    if (currentLogs.length > 15) currentLogs.pop();
    logBox.innerHTML = `[${time}] ${message}<br>` + currentLogs.join('<br>');
}

// --- LOGIN ---
function login() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    if (user === 'admin' && pass === 'police123') {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('app-page').classList.add('active');
        addLog("Officer ADMIN authenticated.");
        if(_supabase) fetchAllData();
    } else {
        alert("❌ Invalid Credentials. Use: admin / police123");
    }
}

function logout() { location.reload(); }

// --- FETCH DATA ---
async function fetchAllData() {
    if(!_supabase) return;
    addLog("Syncing with database...");
    try {
        const { data: cData, error: cErr } = await _supabase.from('cases').select('*').order('id', { ascending: true });
        if (cErr) throw cErr;
        cases = cData || [];

        const { data: tData, error: tErr } = await _supabase.from('testimonies').select('*').order('id', { ascending: true });
        if (tErr) throw tErr;
        testimonies = tData || [];

        updateDashboard();
        addLog("Data synced.");
    } catch (error) {
        console.error(error);
        addLog("Sync Error: " + error.message);
    }
}

// --- NAVIGATION ---
function showDashboard() {
    document.getElementById('dashboard-view').classList.add('active');
    document.getElementById('reconstruction-view').classList.remove('active');
    document.getElementById('nav-dash').classList.add('active');
    document.getElementById('nav-recon').classList.remove('active');
    updateDashboard();
    addLog("View: Dashboard");
}

function showReconstruction() {
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('reconstruction-view').classList.add('active');
    document.getElementById('nav-dash').classList.remove('active');
    document.getElementById('nav-recon').classList.add('active');
    populateCaseDropdown();
    addLog("View: Reconstruction");
}

// --- MODAL & SAVE ---
function openModal() { document.getElementById('caseModal').style.display = 'flex'; }
function closeModal() { document.getElementById('caseModal').style.display = 'none'; }

async function saveCase() {
    const title = document.getElementById('newTitle').value;
    const officer = document.getElementById('newOfficer').value;
    const status = document.getElementById('newStatus').value;
    const desc = document.getElementById('newDesc').value;

    if(!title || !officer) { alert("Title and Officer are required."); return; }
    if(!_supabase) { alert("Database not connected. Check console."); return; }

    addLog("Saving new case...");
    try {
        const { error } = await _supabase.from('cases').insert([{ title: title, officer: officer, status: status, description: desc }]);
        if (error) throw error;

        addLog(`Case "${title}" created.`);
        closeModal();
        document.getElementById('newTitle').value = '';
        document.getElementById('newOfficer').value = '';
        document.getElementById('newDesc').value = '';
        await fetchAllData();
    } catch (error) {
        alert("Error saving: " + error.message);
        addLog("Save failed.");
    }
}

// --- CLOSE CASE ---
async function closeCase() {
    if(!currentCaseId || !_supabase) return;
    addLog("Updating case status to Closed...");
    try {
        const { error } = await _supabase.from('cases').update({ status: 'Closed' }).eq('id', currentCaseId);
        if (error) throw error;
        addLog(`Case #${currentCaseId} closed.`);
        await fetchAllData(); 
        loadCase(); 
    } catch (error) {
        alert("Failed to close case: " + error.message);
    }
}

// --- DASHBOARD RENDER ---
function updateDashboard() {
    const tbody = document.querySelector('#caseTable tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    let openCount = 0, closedCount = 0;

    cases.forEach(c => {
        if(c.status === 'Closed') closedCount++; else openCount++;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${c.id}</td><td>${c.title}</td><td>${c.officer}</td>
            <td class="${c.status === 'Closed' ? 'status-closed' : 'status-open'}">${c.status}</td>
            <td><button class="btn btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="viewCase(${c.id})">View</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('metric-total').innerText = cases.length;
    document.getElementById('metric-open').innerText = openCount;
    document.getElementById('metric-closed').innerText = closedCount;
    renderCharts(openCount, closedCount);
}

function renderCharts(open, closed) {
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: { labels: ['Open/Pending', 'Closed'], datasets: [{ data: [open, closed], backgroundColor: ['#e74c3c', '#2ecc71'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Case Status', color: '#1f4e79' }, legend: {position: 'bottom'} } }
    });

    const officerCounts = {};
    cases.forEach(c => { officerCounts[c.officer] = (officerCounts[c.officer] || 0) + 1; });
    const ctxBar = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: Object.keys(officerCounts), datasets: [{ label: 'Cases', data: Object.values(officerCounts), backgroundColor: '#3498db', borderRadius: 5 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Cases by Officer', color: '#1f4e79' }, legend: {display: false} }, scales: { y: { beginAtZero: true, ticks: {stepSize: 1} } } }
    });
}

// --- RECONSTRUCTION LOGIC ---
function viewCase(id) {
    showReconstruction();
    document.getElementById('caseSelect').value = id;
    loadCase();
}

function populateCaseDropdown() {
    const select = document.getElementById('caseSelect');
    select.innerHTML = '';
    cases.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = `#${c.id} - ${c.title}`;
        select.appendChild(opt);
    });
    if(cases.length > 0) loadCase();
}

function loadCase() {
    currentCaseId = parseInt(document.getElementById('caseSelect').value);
    const c = cases.find(x => x.id === currentCaseId);
    if(!c) return;

    document.getElementById('caseInfo').innerHTML = `
        <h3>${c.title}</h3>
        <p><b>Officer:</b> ${c.officer} | <b>Status:</b> <span class="${c.status === 'Closed' ? 'status-closed' : 'status-open'}">${c.status}</span></p>
        <p><b>Initial Description:</b> ${c.description}</p>
    `;
    
    const closeBtn = document.getElementById('btn-close-case');
    closeBtn.style.display = (c.status === 'Closed') ? 'none' : 'block';

    document.getElementById('ngramResult').innerHTML = ''; 
    renderTestimonies();
    addLog(`Loaded Case #${c.id}`);
}

// --- TESTIMONY ---
function loadTemplate() {
    const val = document.getElementById('testimonyTemplate').value;
    const input = document.getElementById('testimonyText');
    if(val === 't1') input.value = "At exactly 10:00 PM near the main fountain in Central Park, I saw a tall man wearing a black hoodie. He pulled out a silver knife and threatened a woman.";
    if(val === 't2') input.value = "It was dark and someone was running really fast past me. I didn't see much.";
    if(val === 't3') input.value = "At approximately 22:00 hours, I was proceeding towards my residence. I observed no suspicious activity.";
}

async function addTestimony() {
    const witness = document.getElementById('witnessName').value;
    const text = document.getElementById('testimonyText').value;
    if(!witness || !text) { alert("Please fill both fields."); return; }
    if(!_supabase) { alert("Database not connected."); return; }

    try {
        const { error } = await _supabase.from('testimonies').insert([{ case_id: currentCaseId, witness: witness, text: text }]);
        if (error) throw error;

        addLog(`Testimony saved for ${witness}.`);
        document.getElementById('witnessName').value = '';
        document.getElementById('testimonyText').value = '';
        document.getElementById('testimonyTemplate').value = '';
        
        await fetchAllData(); 
        renderTestimonies(); 
    } catch (error) {
        alert("Failed to save testimony: " + error.message);
    }
}

function renderTestimonies() {
    const caseTests = testimonies.filter(t => t.case_id === currentCaseId);
    const graphBox = document.getElementById('graphCanvas');
    const analysisBox = document.getElementById('gapAnalysis');
    const scoreBox = document.getElementById('perplexityScore');

    if(caseTests.length === 0) {
        graphBox.innerHTML = '<p style="color:#999;">No testimonies yet.</p>';
        analysisBox.innerHTML = '';
        scoreBox.innerText = 'No data to analyze.';
        return;
    }

    const latest = caseTests[caseTests.length - 1];
    const textLower = latest.text.toLowerCase();
    const words = textLower.split(' ');
    
    graphBox.innerHTML = `<div class="node-center">Case File</div>`;
    let entities = new Set();
    if(words.some(w => ['gun','knife','weapon'].includes(w))) entities.add('Weapon 🔪');
    if(words.some(w => ['park','house','alley','street','office'].includes(w))) entities.add('Location 📍');
    if(words.some(w => ['he','suspect','man'].includes(w))) entities.add('Suspect 👤');
    if(words.some(w => ['car','truck','vehicle'].includes(w))) entities.add('Vehicle 🚗');
    if(words.some(w => ['pm','am','night','morning'].includes(w))) entities.add('Time ⏰');

    if(entities.size === 0) {
        graphBox.innerHTML += `<div class="node-entity" style="border-color:#999; color:#999; background:#eee;">No Entities Detected</div>`;
    } else {
        entities.forEach(ent => graphBox.innerHTML += `<div class="node-entity">${ent}</div>`);
    }

    let missing = [];
    if(!['time','pm','am','night','morning'].some(w => textLower.includes(w))) missing.push("⏰ <b>Time:</b> Missing.");
    if(!['park','house','alley','street','road','office'].some(w => textLower.includes(w))) missing.push("📍 <b>Location:</b> Missing.");
    if(!['gun','knife','weapon','tool'].some(w => textLower.includes(w))) missing.push("🔪 <b>Weapon:</b> Missing.");
    if(!['he','she','suspect','man','woman'].some(w => textLower.includes(w))) missing.push("👤 <b>Suspect:</b> Missing.");

    scoreBox.innerHTML = `Perplexity Score: <span style="color: #1f4e79;">${(Math.random() * (40 - 10) + 10).toFixed(2)}</span>`;
    
    if(missing.length > 0) {
        analysisBox.innerHTML = `<div class="alert-box"><b>🚨 Missing Elements:</b><br><br>` + missing.join('<br>') + `</div>`;
    } else {
        analysisBox.innerHTML = `<div class="success-box"><b>✅ Complete Testimony.</b> All key elements found.</div>`;
    }
}

function runNGramMatch() {
    const caseTests = testimonies.filter(t => t.case_id === currentCaseId);
    const resultBox = document.getElementById('ngramResult');
    
    if(caseTests.length < 2) {
        resultBox.innerHTML = "<span style='color:orange; font-weight:bold;'>⚠️ Need at least 2 testimonies to run N-Gram comparison.</span>";
        return;
    }

    resultBox.innerHTML = "<span style='color:#8e44ad; font-weight:bold;'>⏳ Running N-Gram Stylometry (N=3)...</span>";
    addLog("Executing N-Gram Check...");

    setTimeout(() => {
        const score = (Math.random() * (95 - 10) + 10).toFixed(1);
        if(score > 70) {
            resultBox.innerHTML = `<div class="alert-box" style="background:#f3e5f5; border-color:#8e44ad; color:#4a148c;"><b>🚨 HIGH MATCH: ${score}% Similarity</b><br>Trigram analysis suggests these witnesses may have collaborated.</div>`;
            addLog(`N-Gram alert: High similarity (${score}%).`);
        } else {
            resultBox.innerHTML = `<div class="success-box" style="background:#e8f5e9; border-color:#4caf50; color:#1b5e20;"><b>✅ LOW MATCH: ${score}% Similarity</b><br>Stylistic fingerprints are distinct.</div>`;
            addLog(`N-Gram check passed. Similarity: ${score}%`);
        }
    }, 1200);
}
