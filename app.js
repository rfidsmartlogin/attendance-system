// app.js
import { firebaseConfig } from './firebase-config.js';

// Extract Firebase modules from global scope
const {
    initializeApp,
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    getDatabase,
    ref,
    onValue,
    set,
    push,
    update,
    remove,
    query,
    limitToLast,
    onChildAdded,
    get,
    child
} = window.firebaseModules;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global state
let currentUser = null;
let currentUserRole = null;
let currentUserData = null;

// DOM elements
const appDiv = document.getElementById('app');

// Navigation routes
const routes = {
    'login': renderLogin,
    'dashboard': renderDashboard,
    'attendance': renderAttendance,
    'students': renderStudents,
    'reports': renderReports,
    'users': renderUsers,
    '': renderLogin // default
};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Fetch user role from database
        const userSnapshot = await get(child(ref(database), `users/${user.uid}`));
        if (userSnapshot.exists()) {
            currentUserData = userSnapshot.val();
            currentUserRole = currentUserData.role;
        } else {
            // Default role if not set
            currentUserRole = 'lecturer';
            // Optionally create user record
        }
        // Redirect to dashboard if hash is empty or login
        const hash = window.location.hash.substring(1) || 'dashboard';
        navigateTo(hash);
    } else {
        currentUser = null;
        currentUserRole = null;
        navigateTo('login');
    }
});

// Hash change listener
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (routes[hash]) {
        routes[hash]();
    } else {
        navigateTo('dashboard');
    }
});

// Navigation helper
function navigateTo(route) {
    window.location.hash = route;
}

// Render functions for each route
function renderLogin() {
    // Login form HTML
    appDiv.innerHTML = `
        <div class="login-container">
            <h2>Smart Attendance System</h2>
            <form id="login-form">
                <input type="email" id="email" placeholder="Email" required>
                <input type="password" id="password" placeholder="Password" required>
                <button type="submit">Login</button>
            </form>
            <button id="google-login">Login with Google</button>
            <p id="login-error" class="error"></p>
        </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            document.getElementById('login-error').textContent = error.message;
        }
    });

    document.getElementById('google-login').addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            document.getElementById('login-error').textContent = error.message;
        }
    });
}

function renderDashboard() {
    if (!currentUser) return navigateTo('login');

    // Check role and show appropriate controls
    const isAdmin = currentUserRole === 'admin';
    const isLecturer = currentUserRole === 'lecturer';

    appDiv.innerHTML = `
        <div class="dashboard">
            <nav class="sidebar">
                <h3>Menu</h3>
                <ul>
                    <li><a href="#dashboard">Dashboard</a></li>
                    <li><a href="#attendance">Attendance Logs</a></li>
                    ${isAdmin ? '<li><a href="#students">Students</a></li>' : ''}
                    ${isAdmin ? '<li><a href="#users">Users</a></li>' : ''}
                    <li><a href="#reports">Reports</a></li>
                    <li><button id="logout-btn">Logout</button></li>
                </ul>
            </nav>
            <main class="content">
                <h1>Dashboard</h1>
                <div class="mode-control">
                    <label>System Mode:</label>
                    <select id="mode-select" ${!isLecturer && !isAdmin ? 'disabled' : ''}>
                        <option value="class">Class</option>
                        <option value="exam">Exam</option>
                        <option value="ca">CA Test</option>
                    </select>
                </div>
                <div class="live-feed">
                    <h2>Live Attendance Feed</h2>
                    <ul id="live-feed-list"></ul>
                </div>
                <div class="stats">
                    <div class="card">Total Students: <span id="total-students">0</span></div>
                    <div class="card">Today's Class: <span id="today-class">0</span></div>
                    <div class="card">Ongoing Exam Sign-ins: <span id="ongoing-exam">0</span></div>
                </div>
            </main>
        </div>
    `;

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    // Load current mode
    const modeRef = ref(database, 'system/mode');
    onValue(modeRef, (snapshot) => {
        const mode = snapshot.val();
        document.getElementById('mode-select').value = mode || 'class';
    });

    // Update mode when changed
    document.getElementById('mode-select').addEventListener('change', (e) => {
        if (isLecturer || isAdmin) {
            set(ref(database, 'system/mode'), e.target.value);
        }
    });

    // Live feed (class attendance only for simplicity)
    const classQuery = query(ref(database, 'attendance/class'), limitToLast(10));
    onChildAdded(classQuery, (snapshot) => {
        const record = snapshot.val();
        const list = document.getElementById('live-feed-list');
        const item = document.createElement('li');
        item.textContent = `${record.name} (${record.studentID}) - ${record.date} ${record.time}`;
        list.prepend(item);
        if (list.children.length > 10) list.removeChild(list.lastChild);
    });

    // Load stats
    get(child(ref(database), 'students')).then((snapshot) => {
        if (snapshot.exists()) {
            const count = Object.keys(snapshot.val()).length;
            document.getElementById('total-students').textContent = count;
        }
    });

    // Today's class count (simplified: count records with today's date)
    const today = new Date().toISOString().split('T')[0];
    const classRef = ref(database, 'attendance/class');
    onValue(classRef, (snapshot) => {
        if (snapshot.exists()) {
            const records = snapshot.val();
            let count = 0;
            Object.values(records).forEach(r => {
                if (r.date === today) count++;
            });
            document.getElementById('today-class').textContent = count;
        }
    });

    // Ongoing exam sign-ins (count records in exam/CA with signoutTime = 0)
    // This requires querying both exam and CA nodes; simplified here.
}

function renderAttendance() {
    // Render attendance logs with tabs for class/exam/CA
    // Similar structure to dashboard, with data tables
    // Implementation omitted for brevity (see full code in repository)
}

function renderStudents() {
    // Admin-only: list, add, edit, delete students
    // Implementation omitted
}

function renderReports() {
    // Charts and analytics
    // Implementation omitted
}

function renderUsers() {
    // Admin-only: user management
    // Implementation omitted
}

// Initial navigation based on current hash
const initialHash = window.location.hash.substring(1);
if (routes[initialHash]) {
    routes[initialHash]();
} else {
    navigateTo('login');
}