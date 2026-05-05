/**
 * Kiss & Drive Application Logic
 * Firebase & Vanilla JS Implementation
 */

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBG0WlfEehzhWdFMM-ioVVDc_SEwIIOv-c",
  authDomain: "kissanddrive-9dc43.firebaseapp.com",
  projectId: "kissanddrive-9dc43",
  storageBucket: "kissanddrive-9dc43.firebasestorage.app",
  messagingSenderId: "260969502667",
  appId: "1:260969502667:web:e9cb0dd2084c2535f6c84e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Global Data Store ---
let appData = {
    volunteers: [],
    shifts: {},
    currentMonth: new Date()
};

// Global State
window.pendingShiftDate = null;
window.pendingPhone = null;
let isDataLoaded = false;
let dbLoadTracker = 0;

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Setup Modal listeners
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('directSignUpModal').classList.remove('show');
    });
    document.getElementById('modalSubmitBtn').addEventListener('click', handleModalSubmit);
    
    window.addEventListener('hashchange', handleRoute);
    
    // Show loading state
    const appDiv = document.getElementById('app');
    appDiv.innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin fa-3x" style="color:var(--primary)"></i><p style="margin-top:20px;">מתחבר למסד הנתונים...</p></div>';
    
    // Initialize Real-time Listeners
    initFirebaseListeners();
});

function initFirebaseListeners() {
    db.collection('volunteers').onSnapshot(snapshot => {
        appData.volunteers = [];
        snapshot.forEach(doc => {
            appData.volunteers.push({ id: doc.id, ...doc.data() });
        });
        checkDataLoaded();
    }, err => {
        console.error("Firebase Volunteers Error:", err);
        showToast('שגיאה. האם הפעלת את ה-Firestore במסוף ה-Firebase?');
    });

    db.collection('shifts').onSnapshot(snapshot => {
        appData.shifts = {};
        snapshot.forEach(doc => {
            appData.shifts[doc.id] = doc.data().volunteers || [];
        });
        checkDataLoaded();
    }, err => {
        console.error("Firebase Shifts Error:", err);
    });
}

function checkDataLoaded() {
    dbLoadTracker++;
    // We expect at least 2 snapshot returns initially (one for each collection)
    if(dbLoadTracker >= 2) {
        if (!isDataLoaded) {
            isDataLoaded = true;
            autoPurgeOldData(); // Run 3-months retention rule
        }
        handleRoute(); // Re-render UI with new data
    }
}

// 3 Months Auto Purge Rule
function autoPurgeOldData() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    cutoffDate.setHours(0,0,0,0);
    
    Object.keys(appData.shifts).forEach(dateStr => {
        const date = new Date(dateStr);
        if (date < cutoffDate) {
            console.log("Purging old shift data:", dateStr);
            db.collection('shifts').doc(dateStr).delete();
        }
    });
}

// --- Router ---
function handleRoute() {
    if(!isDataLoaded) return;
    
    const hash = window.location.hash || '#';
    const appDiv = document.getElementById('app');
    
    appDiv.innerHTML = '';
    
    if (hash === '#') {
        renderGuestView(appDiv);
    } else if (hash === '#register') {
        renderRegisterView(appDiv);
    } else if (hash === '#manage') {
        renderManageView(appDiv);
    } else if (hash === '#admin') {
        renderAdminView(appDiv);
    } else {
        renderGuestView(appDiv);
    }
}

// --- Renderers ---

function renderHeader(container, title, subtitle, isAdmin = false) {
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
        ${isAdmin ? '<div class="admin-badge">מצב ניהול</div>' : ''}
        <h1>${title}</h1>
        <p>${subtitle}</p>
    `;
    container.appendChild(header);
}

function renderNavPills(container, currentHash) {
    const nav = document.createElement('div');
    nav.className = 'nav-pills';
    nav.innerHTML = `
        <a href="#" class="nav-pill ${currentHash === '#' ? 'active' : ''}">לוח משמרות</a>
        <a href="#register" class="nav-pill ${currentHash === '#register' ? 'active' : ''}">התנדבות</a>
        <a href="#manage" class="nav-pill ${currentHash === '#manage' ? 'active' : ''}">שלי</a>
    `;
    container.appendChild(nav);
}

// Guest View
function renderGuestView(container) {
    renderHeader(container, 'נשק וסע 🚗', 'לוח משמרות לחודש הנוכחי');
    renderNavPills(container, '#');
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="calendar-header">
            <button class="calendar-nav" id="prevMonth"><i class="fas fa-chevron-right"></i></button>
            <h3>${MONTHS[appData.currentMonth.getMonth()]} ${appData.currentMonth.getFullYear()}</h3>
            <button class="calendar-nav" id="nextMonth"><i class="fas fa-chevron-left"></i></button>
        </div>
        <div class="calendar-grid" id="calendarGrid"></div>
        <div class="calendar-legend">
            <div class="legend-item"><div class="legend-dot status-full"></div>מלא (2)</div>
            <div class="legend-item"><div class="legend-dot status-partial"></div>חסר 1</div>
            <div class="legend-item"><div class="legend-dot status-missing"></div>ריק</div>
        </div>
        
        <div style="margin-top: 20px;">
            <h4 style="margin-bottom: 10px;">פירוט משמרות:</h4>
            <div id="shiftsList"></div>
        </div>
    `;
    container.appendChild(card);
    
    generateCalendarGrid(document.getElementById('calendarGrid'), document.getElementById('shiftsList'), false);
    
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
}

// Register View
function renderRegisterView(container) {
    renderHeader(container, 'הצטרפות לתורנות 🙋', 'הזן את פרטיך ובחר זמנים פנויים');
    renderNavPills(container, '#register');
    
    const formCard = document.createElement('div');
    formCard.className = 'card';
    
    let pendingMsg = '';
    if (window.pendingShiftDate) {
        const [y,m,d] = window.pendingShiftDate.split('-');
        pendingMsg = `<div style="background:var(--primary-light); color:white; padding:10px; border-radius:var(--radius-sm); margin-bottom:15px;">
            נראה שאתה חדש! אנא השלם את הרישום כדי להשתבץ ב-${d}/${m}/${y}.
        </div>`;
    }
    
    formCard.innerHTML = `
        ${pendingMsg}
        <form id="registerForm">
            <div class="form-group">
                <label>שם מלא</label>
                <input type="text" id="nameInput" class="form-control" required placeholder="למשל: ישראל ישראלי">
            </div>
            <div class="form-group">
                <label>מספר טלפון</label>
                <input type="tel" id="phoneInput" class="form-control" required placeholder="050-1234567" value="${window.pendingPhone || ''}" pattern="^05\\d-?\\d{7}$" title="מספר טלפון חייב להכיל 10 ספרות ולהתחיל ב-05">
            </div>
            <div class="form-group">
                <label>שכבת הילד/ה (ניתן לבחור עד 4)</label>
                <div class="checkbox-grid" id="gradesGrid">
                    ${['א', 'ב', 'ג', 'ד', 'ה', 'ו'].map(g => `
                        <label class="checkbox-btn">
                            <input type="checkbox" name="grades" value="${g}">
                            <span class="checkmark">${g}'</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div style="margin: 30px 0; border-top: 1px solid var(--border); padding-top: 20px;">
                <h4 style="margin-bottom: 15px;">בחירת מועדים להתנדבות:</h4>
                <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 15px;">ניתן לבחור תאריך ספציפי <b>או</b> לבחור ימים קבועים בשבוע.</p>
                
                <div class="form-group">
                    <label>תאריך ספציפי (אופציונלי)</label>
                    <input type="date" id="specificDateInput" class="form-control" min="${formatDate(new Date())}" value="${window.pendingShiftDate || ''}">
                </div>
                
                <div class="form-group">
                    <label>באילו ימים בשבוע נוח לך להתנדב?</label>
                    <div class="checkbox-grid">
                        ${HEBREW_DAYS.map((day, idx) => `
                            <label class="checkbox-btn">
                                <input type="checkbox" name="days" value="${idx}">
                                <span class="checkmark">יום ${day}'</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>חודשים מועדפים (אופציונלי)</label>
                    <div class="checkbox-grid">
                        ${MONTHS.map((m, idx) => `
                            <label class="checkbox-btn">
                                <input type="checkbox" name="months" value="${idx}">
                                <span class="checkmark" style="font-size: 0.8rem;">${m}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>

            <button type="submit" id="submitRegBtn" class="btn btn-primary">
                <i class="fas fa-paper-plane"></i> שלח זמינות והצטרף
            </button>
        </form>
    `;
    container.appendChild(formCard);
    
    // Grade limit logic
    const gradeCheckboxes = document.querySelectorAll('input[name="grades"]');
    gradeCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const checked = document.querySelectorAll('input[name="grades"]:checked');
            if (checked.length >= 4) {
                gradeCheckboxes.forEach(box => {
                    if (!box.checked) box.disabled = true;
                });
            } else {
                gradeCheckboxes.forEach(box => box.disabled = false);
            }
        });
    });
    
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('submitRegBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
        
        const name = document.getElementById('nameInput').value;
        const phone = document.getElementById('phoneInput').value;
        const specificDate = document.getElementById('specificDateInput').value;
        const grades = Array.from(document.querySelectorAll('input[name="grades"]:checked')).map(cb => cb.value);
        const prefMonths = Array.from(document.querySelectorAll('input[name="months"]:checked')).map(cb => cb.value);
        const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => cb.value);
        
        if (grades.length === 0) { showToast('אנא בחר לפחות שכבה אחת'); btn.disabled=false; return; }
        if (days.length === 0 && !specificDate) { showToast('אנא בחר יום בשבוע או תאריך ספציפי'); btn.disabled=false; return; }
        
        try {
            const existingUser = appData.volunteers.find(v => v.phone === phone);
            let volunteerIdToUse = '';
            
            if (existingUser) {
                volunteerIdToUse = existingUser.id;
                await db.collection('volunteers').doc(volunteerIdToUse).update({ name, grades, prefMonths });
            } else {
                const newDocRef = db.collection('volunteers').doc();
                volunteerIdToUse = newDocRef.id;
                await newDocRef.set({ name, phone, grades, prefMonths, createdAt: new Date().toISOString() });
            }
            
            // Scheduling logic
            if (specificDate) {
                await addVolunteerToShiftDb(specificDate, volunteerIdToUse);
            } 
            
            if (days.length > 0) {
                await scheduleVolunteerFirebase(volunteerIdToUse, days, prefMonths);
            }
            
            // Clear global state
            window.pendingPhone = null;
            window.pendingShiftDate = null;
            
            showToast('תודה! נשמרת בהצלחה.');
            setTimeout(() => { window.location.hash = '#'; }, 2000);
            
        } catch (error) {
            console.error(error);
            showToast('אירעה שגיאה בשמירה. נסה שוב.');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> שלח זמינות והצטרף';
        }
    });
}

// Manage Shifts View
function renderManageView(container) {
    renderHeader(container, 'המשמרות שלי 📱', 'ניהול וביטול משמרות קיימות');
    renderNavPills(container, '#manage');
    
    const card = document.createElement('div');
    card.className = 'card';
    
    card.innerHTML = `
        <div id="loginSection">
            <p style="margin-bottom: 15px;">הכנס את מספר הטלפון שאיתו נרשמת כדי לראות את המשמרות העתידיות שלך:</p>
            <div class="form-group">
                <input type="tel" id="managePhone" class="form-control" placeholder="למשל: 050-1234567" autocomplete="tel" pattern="^05\\d-?\\d{7}$" title="מספר טלפון חייב להכיל 10 ספרות ולהתחיל ב-05">
            </div>
            <button id="searchShiftsBtn" class="btn btn-primary">הצג משמרות</button>
        </div>
        <div id="myShiftsSection" style="display:none; margin-top: 20px;">
            <h4 style="margin-bottom: 15px;">המשמרות העתידיות שלך:</h4>
            <div id="myShiftsList"></div>
            <button onclick="location.reload()" class="btn" style="margin-top: 15px; background: var(--bg-main);">התנתק / חזרה</button>
        </div>
    `;
    container.appendChild(card);
    
    document.getElementById('searchShiftsBtn').addEventListener('click', () => {
        const phone = document.getElementById('managePhone').value.trim();
        if (!phone) { showToast('נא להזין מספר טלפון'); return; }
        
        const volunteer = appData.volunteers.find(v => v.phone === phone);
        if (!volunteer) {
            showToast('לא מצאנו משתמש עם מספר הטלפון הזה');
            return;
        }
        
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('myShiftsSection').style.display = 'block';
        
        const listEl = document.getElementById('myShiftsList');
        listEl.innerHTML = '';
        
        let found = false;
        Object.keys(appData.shifts).sort().forEach(dateStr => {
            const shiftDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            if (shiftDate >= today) {
                const shiftArr = appData.shifts[dateStr];
                const myShift = shiftArr.find(s => s.volunteerId === volunteer.id);
                if (myShift) {
                    found = true;
                    const item = document.createElement('div');
                    item.className = 'shift-item';
                    item.innerHTML = `
                        <div class="shift-date">
                            <strong>יום ${HEBREW_DAYS[shiftDate.getDay()]}'</strong>
                            <span>${shiftDate.getDate()}/${shiftDate.getMonth() + 1}</span>
                        </div>
                        <div>
                            <button class="btn btn-danger" onclick="cancelShiftParent('${dateStr}', '${volunteer.id}')" style="padding: 5px 15px; font-size: 0.9rem;">
                                ביטול / חולה
                            </button>
                        </div>
                    `;
                    listEl.appendChild(item);
                }
            }
        });
        
        if (!found) {
            listEl.innerHTML = '<p style="color: var(--text-secondary)">אין לך משמרות עתידיות משובצות.</p>';
        }
    });
}

window.cancelShiftParent = async function(dateStr, volunteerId) {
    if(confirm('האם אתה בטוח שברצונך לבטל משמרת זו? (מנהל המערכת יעודכן מיד)')) {
        try {
            await removeVolunteerFromShiftDb(dateStr, volunteerId);
            showToast('המשמרת בוטלה בהצלחה');
            document.getElementById('searchShiftsBtn').click(); // Refresh list visually
        } catch (e) {
            showToast('שגיאה בביטול המשמרת');
        }
    }
};

// Admin View
function renderAdminView(container) {
    renderHeader(container, 'פאנל ניהול ⚙️', 'ניהול מתנדבים, שיבוצים והתראות', true);
    
    // --- Stats & Leaderboards ---
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-grid';
    const missingShifts = countMissingShifts();
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${appData.volunteers.length}</div>
            <div class="stat-label">סך הכל מתנדבים</div>
        </div>
        <div class="stat-card" style="${missingShifts > 0 ? 'border-color: var(--danger);' : ''}">
            <div class="stat-value" style="color: ${missingShifts > 0 ? 'var(--danger)' : 'var(--secondary)'}">${missingShifts}</div>
            <div class="stat-label">משמרות חסרות החודש</div>
        </div>
    `;
    container.appendChild(statsContainer);
    
    // Leaderboards (Last 3 months)
    const { topVolunteers, topGrades } = calculateLeaderboards();
    
    const leaderCard = document.createElement('div');
    leaderCard.className = 'card';
    leaderCard.innerHTML = `
        <h4 style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">🏆 דוחות רבעון אחרון</h4>
        <div style="display:flex; justify-content:space-between; gap:15px;">
            <div style="flex:1;">
                <strong style="color:var(--primary); font-size:0.9rem;">מתנדבים מובילים:</strong>
                <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.85rem;">
                    ${topVolunteers.map(v => `<li>${v.name} <span style="background:var(--bg-main); padding:2px 6px; border-radius:10px;">${v.count}</span></li>`).join('')}
                    ${topVolunteers.length===0 ? '<li>אין נתונים</li>' : ''}
                </ul>
            </div>
            <div style="flex:1;">
                <strong style="color:var(--primary); font-size:0.9rem;">שכבות מובילות:</strong>
                <ul style="list-style:none; padding:0; margin-top:5px; font-size:0.85rem;">
                    ${topGrades.map(g => `<li>שכבה ${g.grade}' <span style="background:var(--bg-main); padding:2px 6px; border-radius:10px;">${g.count}</span></li>`).join('')}
                    ${topGrades.length===0 ? '<li>אין נתונים</li>' : ''}
                </ul>
            </div>
        </div>
    `;
    container.appendChild(leaderCard);
    
    // Calendar
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="calendar-header">
            <button class="calendar-nav" id="prevMonthAdmin"><i class="fas fa-chevron-right"></i></button>
            <h3>${MONTHS[appData.currentMonth.getMonth()]} ${appData.currentMonth.getFullYear()}</h3>
            <button class="calendar-nav" id="nextMonthAdmin"><i class="fas fa-chevron-left"></i></button>
        </div>
        <div style="margin-top: 20px;">
            <div id="shiftsListAdmin"></div>
        </div>
        <div style="margin-top: 30px; text-align: center; border-top: 1px solid var(--border); padding-top: 20px;">
            <button onclick="window.deleteAllDatabase()" class="btn btn-danger" style="width: auto;">
                <i class="fas fa-trash-alt"></i> מחיקת כל מסד הנתונים (איפוס)
            </button>
        </div>
    `;
    container.appendChild(card);
    
    generateAdminShiftsList(document.getElementById('shiftsListAdmin'));
    
    document.getElementById('prevMonthAdmin').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonthAdmin').addEventListener('click', () => changeMonth(1));
    
    const fab = document.createElement('a');
    fab.className = 'fab';
    fab.href = '#';
    fab.innerHTML = '<i class="fas fa-home"></i>';
    container.appendChild(fab);
}

// --- Helpers & DB Functions ---

async function addVolunteerToShiftDb(dateStr, volunteerId) {
    const shiftRef = db.collection('shifts').doc(dateStr);
    const doc = await shiftRef.get();
    let vols = [];
    if(doc.exists) vols = doc.data().volunteers || [];
    
    if(!vols.find(s => s.volunteerId === volunteerId)) {
        vols.push({ volunteerId: volunteerId, status: 'confirmed' });
        await shiftRef.set({ volunteers: vols });
    }
}

window.deleteAllDatabase = async function() {
    const confirmation = confirm('⚠️ אזהרה חמורה!\\nהאם אתה בטוח שברצונך למחוק את כל מסד הנתונים?\\nכל המתנדבים וכל המשמרות יימחקו ללא אפשרות שחזור!');
    if (!confirmation) return;
    
    const doubleCheck = prompt('כדי לאשר את המחיקה, הקלד "מחק" בתיבה למטה:');
    if (doubleCheck !== 'מחק') {
        showToast('פעולת המחיקה בוטלה.');
        return;
    }
    
    try {
        const shiftsSnapshot = await db.collection('shifts').get();
        const batch1 = db.batch();
        shiftsSnapshot.docs.forEach(doc => batch1.delete(doc.ref));
        await batch1.commit();
        
        const volunteersSnapshot = await db.collection('volunteers').get();
        const batch2 = db.batch();
        volunteersSnapshot.docs.forEach(doc => batch2.delete(doc.ref));
        await batch2.commit();
        
        showToast('כל הנתונים נמחקו בהצלחה. מרענן...');
        setTimeout(() => location.reload(), 2000);
    } catch (error) {
        console.error("Error deleting database:", error);
        showToast('אירעה שגיאה במחיקת הנתונים.');
    }
};

async function removeVolunteerFromShiftDb(dateStr, volunteerId) {
    const shiftRef = db.collection('shifts').doc(dateStr);
    const doc = await shiftRef.get();
    if(doc.exists) {
        let vols = doc.data().volunteers || [];
        vols = vols.filter(s => s.volunteerId !== volunteerId);
        await shiftRef.set({ volunteers: vols });
    }
}

function calculateLeaderboards() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    let volunteerCount = {};
    let gradeCount = {};
    
    Object.keys(appData.shifts).forEach(dateStr => {
        const date = new Date(dateStr);
        if (date >= threeMonthsAgo && date <= new Date()) {
            const vols = appData.shifts[dateStr];
            vols.forEach(v => {
                volunteerCount[v.volunteerId] = (volunteerCount[v.volunteerId] || 0) + 1;
                const user = getVolunteerById(v.volunteerId);
                if (user && user.grades) {
                    user.grades.forEach(g => {
                        gradeCount[g] = (gradeCount[g] || 0) + 1;
                    });
                }
            });
        }
    });
    
    const topVolunteers = Object.entries(volunteerCount)
        .sort((a,b) => b[1] - a[1]).slice(0, 3)
        .map(entry => {
            const u = getVolunteerById(entry[0]);
            return { name: u ? u.name : 'לא ידוע', count: entry[1] };
        });
        
    const topGrades = Object.entries(gradeCount)
        .sort((a,b) => b[1] - a[1]).slice(0, 3)
        .map(entry => ({ grade: entry[0], count: entry[1] }));
        
    return { topVolunteers, topGrades };
}

function changeMonth(delta) {
    const newMonth = new Date(appData.currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    appData.currentMonth = newMonth;
    handleRoute(); 
}

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function countMissingShifts() {
    let missing = 0;
    const year = appData.currentMonth.getFullYear();
    const month = appData.currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        if (date.getDay() !== 6) {
            const dateStr = formatDate(date);
            const shift = appData.shifts[dateStr] || [];
            if (shift.length < 2) {
                missing += (2 - shift.length);
            }
        }
    }
    return missing;
}

function getVolunteerById(id) {
    return appData.volunteers.find(v => v.id === id);
}

// Generate Calendar View
function generateCalendarGrid(gridEl, listEl, isAdmin) {
    gridEl.innerHTML = '';
    listEl.innerHTML = '';
    
    HEBREW_DAYS.forEach(day => {
        const d = document.createElement('div');
        d.className = 'day-name';
        d.textContent = day;
        gridEl.appendChild(d);
    });
    
    const year = appData.currentMonth.getFullYear();
    const month = appData.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDay = firstDay.getDay();
    if (startDay === 6) startDay = 0; 
    
    if (firstDay.getDay() !== 6) {
        for (let i = 0; i < startDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell empty';
            gridEl.appendChild(cell);
        }
    }
    
    let hasShiftsToShow = false;
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        if (date.getDay() === 6) continue;
        
        const dateStr = formatDate(date);
        const shift = appData.shifts[dateStr] || [];
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        let statusClass = 'status-missing';
        if (shift.length >= 2) statusClass = 'status-full';
        else if (shift.length === 1) statusClass = 'status-partial';
        
        cell.innerHTML = `
            <span class="day-number">${i}</span>
            <div class="day-status ${statusClass}"></div>
        `;
        
        if (shift.length > 0 || (date >= new Date(new Date().setHours(0,0,0,0)) && shift.length < 2)) {
            hasShiftsToShow = true;
            const shiftItem = createShiftListItem(date, shift, isAdmin);
            shiftItem.id = `shift-row-${dateStr}`;
            listEl.appendChild(shiftItem);
            
            // Scroll to element on click
            cell.onclick = () => {
                const target = document.getElementById(`shift-row-${dateStr}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('highlight-row');
                    setTimeout(() => target.classList.remove('highlight-row'), 2000);
                }
            };
        } else {
            cell.onclick = () => showToast('אין משמרת פעילה ביום זה');
        }
        
        gridEl.appendChild(cell);
    }
    
    if (!hasShiftsToShow) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-light); padding: 20px;">אין משמרות להציג</p>';
    }
}

function generateAdminShiftsList(listEl) {
    listEl.innerHTML = '';
    const year = appData.currentMonth.getFullYear();
    const month = appData.currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        if (date.getDay() === 6) continue;
        
        const dateStr = formatDate(date);
        const shift = appData.shifts[dateStr] || [];
        
        listEl.appendChild(createShiftListItem(date, shift, true));
    }
}

function createShiftListItem(date, shift, isAdmin) {
    const item = document.createElement('div');
    item.className = 'shift-item';
    
    const isMissing = shift.length < 2;
    const dayName = HEBREW_DAYS[date.getDay()];
    
    let volunteersHtml = '';
    
    if (shift.length === 0) {
        volunteersHtml = `<div class="volunteer-badge missing" style="margin-bottom:5px;"><i class="fas fa-exclamation-circle"></i> חסרים מתנדבים</div>`;
    } else {
        volunteersHtml = shift.map(s => {
            const v = getVolunteerById(s.volunteerId);
            if (!v) return '';
            
            const gradesStr = Array.isArray(v.grades) ? v.grades.join(', ') : v.grade;
            
            if (isAdmin) {
                const waMessage = encodeURIComponent(`היי ${v.name}, תזכורת למשמרת ב"נשק וסע" ביום ${dayName}' בתאריך ${date.getDate()}/${date.getMonth()+1}. נשמח לאישור הגעה!`);
                const waLink = `https://wa.me/972${v.phone.replace(/-/g, '').substring(1)}?text=${waMessage}`;
                
                return `
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <a href="${waLink}" target="_blank" class="btn-whatsapp" title="שלח וואטסאפ"><i class="fab fa-whatsapp"></i></a>
                        <div class="volunteer-badge">
                            <i class="fas fa-user"></i> ${v.name} (${v.phone}) - שכבות ${gradesStr}'
                            <button class="cancel-btn" onclick="cancelShiftAdmin('${formatDate(date)}', '${v.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; margin-right:5px;" title="בטל שיבוץ"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
            } else {
                return `<div class="volunteer-badge" style="margin-bottom:5px;"><i class="fas fa-user"></i> ${v.name}</div>`;
            }
        }).join('');
        
    }
    
    // Add Direct Signup Button for Guests if missing
    if (isMissing && !isAdmin && date >= new Date(new Date().setHours(0,0,0,0))) {
        volunteersHtml += `
            <div style="display:flex; flex-direction:column; align-items:flex-end;">
                ${shift.length === 1 ? '<div class="volunteer-badge missing" style="margin-top:5px;"><i class="fas fa-plus"></i> חסר מתנדב</div>' : ''}
                <button class="btn-direct-signup" onclick="window.openDirectSignUp('${formatDate(date)}')">
                    <i class="fas fa-bolt"></i> אני אתנדב ליום זה!
                </button>
            </div>
        `;
    } else if (isMissing && isAdmin) {
        volunteersHtml += `<div class="volunteer-badge missing" style="margin-top:5px;"><i class="fas fa-plus"></i> חסר מתנדב</div>`;
    }
    
    item.innerHTML = `
        <div class="shift-date">
            <strong>יום ${dayName}'</strong>
            <span>${date.getDate()}/${date.getMonth() + 1}</span>
        </div>
        <div class="volunteers">
            ${volunteersHtml}
        </div>
    `;
    
    return item;
}

// Modal Logic
window.openDirectSignUp = function(dateStr) {
    const modal = document.getElementById('directSignUpModal');
    const display = document.getElementById('modalDateDisplay');
    const [y,m,d] = dateStr.split('-');
    display.textContent = `לתאריך: ${d}/${m}/${y}`;
    window.pendingShiftDate = dateStr;
    modal.classList.add('show');
    document.getElementById('modalPhoneInput').value = '';
    document.getElementById('modalPhoneInput').focus();
};

async function handleModalSubmit() {
    const phone = document.getElementById('modalPhoneInput').value.trim();
    if(!phone) { showToast('נא להזין מספר טלפון'); return; }
    
    const volunteer = appData.volunteers.find(v => v.phone === phone);
    const dateStr = window.pendingShiftDate;
    
    document.getElementById('directSignUpModal').classList.remove('show');
    
    if (volunteer) {
        try {
            await addVolunteerToShiftDb(dateStr, volunteer.id);
            showToast(`מעולה ${volunteer.name}! שובצת בהצלחה למשמרת.`);
            window.pendingShiftDate = null;
        } catch(e) {
            showToast('שגיאה. נסה שוב מאוחר יותר.');
        }
    } else {
        // Redirect to register
        window.pendingPhone = phone;
        showToast('מספר הטלפון לא במאגר. אנא השלם הרשמה קצרה.');
        window.location.hash = '#register';
    }
}

window.cancelShiftAdmin = async function(dateStr, volunteerId) {
    if(confirm('האם אתה בטוח שברצונך לבטל את המשמרת של הורה זה?')) {
        try {
            await removeVolunteerFromShiftDb(dateStr, volunteerId);
            showToast('המשמרת בוטלה בהצלחה');
        } catch(e) {
            showToast('שגיאה בביטול המשמרת');
        }
    }
};

// Async scheduling algorithm to Firebase
async function scheduleVolunteerFirebase(volunteerId, preferredDaysStr, prefMonthsStr) {
    const preferredDays = preferredDaysStr.map(Number);
    const prefMonths = prefMonthsStr ? prefMonthsStr.map(Number) : [];
    
    const year = appData.currentMonth.getFullYear();
    const month = appData.currentMonth.getMonth();
    
    // Just find next available matching day and write it
    for (let i = 1; i <= 28; i++) {
        const date = new Date(year, month, i);
        if (date < new Date(new Date().setHours(0,0,0,0))) continue; 
        
        if (prefMonths.length > 0 && !prefMonths.includes(month)) continue;
        
        if (preferredDays.includes(date.getDay())) {
            const dateStr = formatDate(date);
            const shiftRef = db.collection('shifts').doc(dateStr);
            const doc = await shiftRef.get();
            let vols = doc.exists ? (doc.data().volunteers || []) : [];
            
            if (vols.length < 2 && !vols.find(s => s.volunteerId === volunteerId)) {
                vols.push({ volunteerId, status: 'confirmed' });
                await shiftRef.set({ volunteers: vols });
                return; // Stop after one successful placement
            }
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
