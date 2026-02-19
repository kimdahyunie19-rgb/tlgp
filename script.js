// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyC3ZeDtcgPTOfvHsSUq752mVBoKUNKTAmU",
  authDomain: "tlgp-wms-15338.firebaseapp.com",
  databaseURL: "https://tlgp-wms-15338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tlgp-wms-15338",
  storageBucket: "tlgp-wms-15338.firebasestorage.app",
  messagingSenderId: "288366896814",
  appId: "1:288366896814:web:55aface3c600634f136f3f",
  measurementId: "G-F754X9HKWF"
};

// INITIALIZE FIREBASE
firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();

// MAIN SYSTEM DATA
let db = [];
let logs = { pull: [], upd: [], del: [], inc: [] };
let currentLogType = 'inc';
let undos = [];
let masterLocs = [];
const am = {"RESIN":"1","FILM":"2","MOLDED PARTS":"3","UN-STERILE":"4","PACKAGING":"5"};

const parseNum = (v) => v ? parseFloat(v.toString().replace(/,/g, '')) || 0 : 0;
const now = () => new Date().toLocaleString('en-GB');

// ENSURE LOGS STRUCTURE IS ALWAYS VALID
function ensureLogs(raw) {
    return {
        pull: Array.isArray(raw.pull) ? raw.pull : [],
        upd:  Array.isArray(raw.upd)  ? raw.upd  : [],
        del:  Array.isArray(raw.del)  ? raw.del  : [],
        inc:  Array.isArray(raw.inc)  ? raw.inc  : []
    };
}

// LOAD DATA FROM CLOUD
window.onload = () => {
    initPermLocs();

    // Sync Inventory
    rdb.ref('j_db').on('value', (snapshot) => {
        const raw = snapshot.val();
        // Firebase may return an object instead of array; convert safely
        if (Array.isArray(raw)) {
            db = raw;
        } else if (raw && typeof raw === 'object') {
            db = Object.values(raw);
        } else {
            db = [];
        }
        re();
    });

    // Sync Logs
    rdb.ref('j_lg').on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        logs = ensureLogs(raw);
        if (document.getElementById('v-his').classList.contains('active')) renderLogs();
    });
};

// LOGIN LOGIC
function checkLogin() {
    const email = document.getElementById('log-email').value;
    const pass = document.getElementById('log-pass').value;
    const err = document.getElementById('log-err');

    if (email === "tlgpwhse3@gmail.com" && pass === "canon") {
        document.getElementById('login-overlay').style.display = 'none';
        sessionStorage.setItem('j_auth', 'true');
    } else {
        err.style.display = 'block';
    }
}

if (sessionStorage.getItem('j_auth') === 'true') {
    document.getElementById('login-overlay').style.display = 'none';
}

function initPermLocs() {
    masterLocs = [];
    const pad = (n) => n.toString().padStart(2, '0');
    const zones = ['TRA','TRB','TRC','TRD','TRE','TRF','TRG','TRH','TRI','TRJ','TRK','TRL','TRM','TRN','TRO','TRP','TRQ'];
    zones.forEach(z => {
        for (let i = 1; i <= 70; i++) {
            for (let l = 1; l <= 5; l++) masterLocs.push(`${z}${pad(i)}${pad(l)}`);
        }
    });
    document.getElementById('loc-list').innerHTML = masterLocs.map(l => `<option value="${l}">`).join('');
}

function re() {
    const filters = Array.from(document.querySelectorAll('.c-src')).map(i => i.value.toLowerCase());
    const viewMode = document.getElementById('f-view').value;
    const fifoOn = document.getElementById('fifo-check').checked;
    let html = "";
    let activeStocks = db.filter(x => parseNum(x.qty) > 0);
    const locSearch = filters[0];

    if (fifoOn || (filters.some((f, i) => f !== "" && i !== 0)) || (viewMode === 'occupied' && filters[0] !== "")) {
        let displayData = [...activeStocks];
        if (fifoOn) displayData.sort((a, b) => new Date(a.dat) - new Date(b.dat));
        displayData.forEach(x => {
            const idx = db.indexOf(x);
            const rowData = [x.loc, x.cod, x.lot, x.qty, x.sts, x.pal, x.dr, x.dat, x.typ, x.acc].map(v => (v || "").toString().toLowerCase());
            if (filters.every((f, i) => rowData[i].includes(f))) {
                if (viewMode === 'empty') return;
                const qCls = x.isMod ? 'qty-modified' : 'qty-normal';
                html += `<tr><td style="color:var(--orange);font-weight:bold">${x.loc}</td><td><b>${x.cod}</b></td><td>${x.lot}</td><td class="${qCls}">${parseNum(x.qty).toLocaleString()}</td><td><span class="bdg status-${(x.sts||'').replace(/\s/g,'')}">${x.sts}</span></td><td>${x.pal||'-'}</td><td>${x.dr||'-'}</td><td>${x.dat||'-'}</td><td>${x.typ||'-'}</td><td>${x.acc||'-'}</td><td><button class="btn btn-blue" onclick="out(${idx})">OUT</button><button class="btn btn-grey" onclick="ed(${idx})">ED</button><button class="btn btn-red" onclick="dl(${idx})">DEL</button></td></tr>`;
            }
        });
    } else {
        let allLocs = [...new Set([...masterLocs, ...db.map(x => x.loc)])];
        allLocs.sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

        allLocs.forEach(loc => {
            const items = activeStocks.filter(x => x.loc === loc);
            const matchesSearch = loc.toLowerCase().includes(locSearch);

            if (items.length > 0) {
                if (viewMode === 'empty') return;
                if (matchesSearch) {
                    items.forEach(x => {
                        const idx = db.indexOf(x);
                        const qCls = x.isMod ? 'qty-modified' : 'qty-normal';
                        html += `<tr><td style="color:var(--orange);font-weight:bold">${x.loc}</td><td><b>${x.cod}</b></td><td>${x.lot}</td><td class="${qCls}">${parseNum(x.qty).toLocaleString()}</td><td><span class="bdg status-${(x.sts||'').replace(/\s/g,'')}">${x.sts}</span></td><td>${x.pal||'-'}</td><td>${x.dr||'-'}</td><td>${x.dat||'-'}</td><td>${x.typ||'-'}</td><td>${x.acc||'-'}</td><td><button class="btn btn-blue" onclick="out(${idx})">OUT</button><button class="btn btn-grey" onclick="ed(${idx})">ED</button><button class="btn btn-red" onclick="dl(${idx})">DEL</button></td></tr>`;
                    });
                }
            } else if (viewMode !== 'occupied') {
                if (matchesSearch) {
                    html += `<tr class="row-empty"><td style="color:var(--orange);font-weight:bold">${loc}</td><td colspan="9">[ VACANT ]</td><td><button class="btn btn-blue" style="background:#fff; color:var(--blue); border:1px solid var(--blue);" onclick="fillLoc('${loc}')">+ STOCK</button></td></tr>`;
                }
            }
        });
    }
    document.getElementById('b-inv').innerHTML = html;
    upd_stats();
}

function changeLogTab(type, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLogType = type;
    document.getElementById('log-loc-filter').value = "";
    document.getElementById('log-cod-filter').value = "";
    document.getElementById('log-lot-filter').value = "";
    document.getElementById('log-qty-filter').value = "";
    renderLogs();
}

function renderLogs() {
    const fLoc = document.getElementById('log-loc-filter').value.toUpperCase();
    const fCod = document.getElementById('log-cod-filter').value.toUpperCase();
    const fLot = document.getElementById('log-lot-filter').value.toUpperCase();
    const fQty = document.getElementById('log-qty-filter').value.toUpperCase();
    const body = document.getElementById('log-body');

    // FIX: always get from ensured logs structure
    logs = ensureLogs(logs);
    let targetData = (currentLogType === 'upd') ? logs.upd : logs[currentLogType];

    const filtered = (targetData || []).filter(l => {
        const loc = (l.loc || "").toUpperCase();
        const cod = (l.cod || "").toUpperCase();
        const lot = (l.lot || "").toUpperCase();
        const qty = (l.outQty || l.qty || "").toString();
        return loc.includes(fLoc) && cod.includes(fCod) && lot.includes(fLot) && qty.includes(fQty);
    });

    body.innerHTML = filtered.map(l =>
        `<tr>
            <td>${l.ts}</td>
            <td>${l.logType || (currentLogType === 'pull' ? 'PULL-OUT' : 'LOG')}</td>
            <td style="font-weight:bold; color:var(--orange)">${l.loc}</td>
            <td>${l.cod}</td>
            <td>${l.lot || '-'}</td>
            <td style="font-weight:bold; color:var(--blue)">${l.outQty || l.qty}</td>
            <td><span class="bdg status-${(l.sts || '').replace(/\s/g,'')}">${l.sts || '-'}</span></td>
            <td>${l.dr || '-'}</td>
            <td>${l.typ || '-'}</td>
            <td>${l.acc || '-'}</td>
        </tr>`
    ).join('') || `<tr><td colspan="10" style="text-align:center; padding:20px; color:#999;">No records found</td></tr>`;
}

// FIX: TRANSFER / SAVE ENTRY
function sv() {
    const id = parseInt(document.getElementById('e-idx').value);
    const loc = v('i-loc').toUpperCase().trim();
    const cod = v('i-cod').toUpperCase().trim();
    const lot = v('i-lot').trim();
    const qty = parseNum(document.getElementById('i-qty').value);

    if (!/^[A-Z]{3}\d{4}$/.test(loc) || !cod || !lot || qty <= 0) {
        alert("❌ Check Inputs! Make sure Location, Item Code, Lot, and Quantity are correct.");
        return;
    }

    const isOcc = db.some((x, i) => x.loc === loc && i !== id && parseNum(x.qty) > 0);
    if (isOcc && !confirm(`⚠️ THIS LOCATION IS ALREADY OCCUPIED! Continue?`)) return;

    const d = {
        loc, cod, lot,
        sts: v('i-sts'),
        qty,
        pal: v('i-pal'),
        dr:  v('i-dr'),
        dat: v('i-dat'),
        typ: v('i-typ'),
        acc: v('i-acc'),
        isMod: (id !== -1 ? db[id].isMod : false)
    };

    undos.push(JSON.stringify(db));
    logs = ensureLogs(logs);

    if (id === -1) {
        // NEW TRANSFER
        db.push(d);
        logs.inc.unshift({ ...d, logType: 'TRANSFER', ts: now() });
    } else {
        // UPDATE/EDIT
        db[id] = d;
        logs.upd.unshift({ ...d, logType: 'EDITED', ts: now() });
    }

    resetForm();
    save();
}

// FIX: PULL-OUT
function out(i) {
    const item = db[i];
    if (!item) { alert("❌ Item not found!"); return; }

    const maxQty = parseNum(item.qty);
    const a = prompt(`Qty to Pull Out (Max: ${maxQty}):`, maxQty);
    if (a === null || a === "") return; // user cancelled

    const outVal = parseNum(a);
    if (outVal <= 0 || outVal > maxQty) {
        alert(`❌ Invalid quantity! Must be between 1 and ${maxQty}.`);
        return;
    }

    undos.push(JSON.stringify(db));
    logs = ensureLogs(logs);
    logs.pull.unshift({ ...item, outQty: outVal, ts: now(), logType: 'PULL-OUT' });

    const remaining = maxQty - outVal;
    if (remaining <= 0) {
        db.splice(i, 1);
    } else {
        db[i].qty = remaining;
        db[i].isMod = true;
    }

    save();
}

// FIX: DELETE
function dl(i) {
    if (confirm("Delete this entry?")) {
        undos.push(JSON.stringify(db));
        logs = ensureLogs(logs);
        logs.upd.unshift({ ...db[i], logType: 'DELETED', ts: now() });
        db.splice(i, 1);
        save();
    }
}

// FIX: BULK IMPORT
function imp() {
    const r = document.getElementById('xl').value.trim();
    if (!r) return;
    const lines = r.split('\n');
    undos.push(JSON.stringify(db));
    logs = ensureLogs(logs);

    lines.forEach(line => {
        const c = line.split('\t');
        if (c[1]) {
            const loc = c[0].toUpperCase().trim();
            const qty = parseNum(c[4]);
            const isOcc = db.some(x => x.loc === loc && parseNum(x.qty) > 0);
            if (isOcc) {
                if (!confirm(`⚠️ LOCATION ${loc} IS ALREADY OCCUPIED! Overwrite?`)) return;
            }
            const typ = (c[8] || "").trim();
            const d = {
                loc,
                cod: c[1].toUpperCase(),
                lot: c[2] || "",
                sts: (c[3] || "PASSED").toUpperCase(),
                qty,
                pal: c[5] || "",
                dr:  c[6] || "",
                dat: c[7] || "",
                typ,
                acc: am[typ] || "",
                isMod: false
            };
            db.push(d);
            logs.inc.unshift({ ...d, logType: 'TRANSFER (BULK)', ts: now() });
        }
    });

    document.getElementById('xl').value = "";
    save();
}

function ed(i) {
    const x = db[i];
    document.getElementById('e-idx').value = i;
    ['loc','cod','lot','sts','qty','pal','dr','dat','typ','acc'].forEach(f => {
        document.getElementById('i-' + f).value = x[f] || "";
    });
}

function un() {
    if (undos.length) {
        db = JSON.parse(undos.pop());
        save();
    } else {
        alert("Nothing to undo!");
    }
}

function mr() {
    if (prompt("Master Password:") === "canon") {
        rdb.ref().remove();
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

function sh(vw, b) {
    document.querySelectorAll('.view, .nav-btn').forEach(x => x.classList.remove('active'));
    document.getElementById('v-' + vw).classList.add('active');
    b.classList.add('active');
    if (vw === 'his') renderLogs();
}

function upd_stats() {
    let q = 0, l = new Set(), p = 0, h = 0, f = 0;
    db.forEach(i => {
        const n = parseNum(i.qty);
        if (n > 0) {
            q += n;
            l.add(i.loc);
            if (i.sts === 'PASSED') p++;
            else if (i.sts === 'HOLD') h++;
            else if (i.sts === 'FAILED') f++;
        }
    });
    document.getElementById('s-q').innerText = q.toLocaleString();
    document.getElementById('s-l').innerText = l.size;
    document.getElementById('s-p').innerText = p;
    document.getElementById('s-h').innerText = h;
    document.getElementById('s-f').innerText = f;
}

function resetForm() {
    document.getElementById('e-idx').value = "-1";
    document.querySelectorAll('.igrid input, .igrid select').forEach(i => i.value = "");
}

function fillLoc(l) {
    document.getElementById('i-loc').value = l;
    document.getElementById('i-cod').focus();
}

function map() {
    document.getElementById('i-acc').value = am[v('i-typ')] || "";
}

const v = (id) => document.getElementById(id).value;

const save = () => {
    // Save db as array
    rdb.ref('j_db').set(db.length > 0 ? db : []);
    // Save logs with ensured structure
    rdb.ref('j_lg').set(ensureLogs(logs));
};
