const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5001').replace(/\/$/, '');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Multer for in-memory file handling before forwarding to Backend API
const upload = multer({
    storage: multer.memoryStorage()
}).fields([
    { name: 'photo', maxCount: 1 },
    { name: 'profilePic', maxCount: 1 },
    { name: 'rules', maxCount: 1 }
]);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(upload);

// Session middleware for frontend state
app.use(session({
    secret: process.env.SESSION_SECRET || 'airbnb-frontend-session-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
    res.locals.isLoggedIn = req.session ? !!req.session.isLoggedIn : false;
    res.locals.user = req.session ? req.session.user : null;
    req.isLoggedIn = res.locals.isLoggedIn;
    next();
});

// Helper for backend API fetch
async function apiFetch(endpoint, options = {}) {
    const url = `${BACKEND_URL}${endpoint}`;
    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, data };
    } catch (err) {
        console.error(`API Fetch Error [${url}]:`, err.message);
        return { ok: false, status: 503, data: null, error: err.message };
    }
}

// Media proxy routes to Backend
app.get('/uploads/:filename', (req, res) => {
    res.redirect(`${BACKEND_URL}/uploads/${req.params.filename}`);
});
app.get('/host/uploads/:filename', (req, res) => {
    res.redirect(`${BACKEND_URL}/uploads/${req.params.filename}`);
});
app.get('/homes/uploads/:filename', (req, res) => {
    res.redirect(`${BACKEND_URL}/uploads/${req.params.filename}`);
});
app.get('/user/avatar/:userId', (req, res) => {
    res.redirect(`${BACKEND_URL}/user/avatar/${req.params.userId}`);
});
app.get('/rules/:homeId', (req, res) => {
    res.redirect(`${BACKEND_URL}/api/homes/${req.params.homeId}/rules`);
});

// ================= STORE & HOMES ================= //

// Home page
app.get('/', async (req, res) => {
    const result = await apiFetch('/api/homes');
    const registeredHomes = result.data && result.data.homes ? result.data.homes : [];
    res.render('store/index', {
        registeredHomes,
        pageTitle: 'airbnb Home',
        currentPage: 'index',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

// Homes list
app.get('/homes', async (req, res) => {
    const result = await apiFetch('/api/homes');
    const registeredHomes = result.data && result.data.homes ? result.data.homes : [];
    res.render('store/home-list', {
        registeredHomes,
        pageTitle: 'Homes List',
        currentPage: 'home',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

// Home detail
app.get('/homes/:homeId', async (req, res) => {
    const result = await apiFetch(`/api/homes/${req.params.homeId}`);
    if (!result.ok || !result.data || !result.data.home) {
        return res.redirect('/homes');
    }
    res.render('store/home-detail', {
        home: result.data.home,
        pageTitle: 'Home Details',
        currentPage: 'home',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

// ================= AUTHENTICATION ================= //

app.get('/login', (req, res) => {
    if (req.isLoggedIn) return res.redirect('/');
    res.render('auth/login', {
        pageTitle: 'Login Page',
        currentPage: 'loginPage',
        isLoggedIn: false,
        errors: [],
        oldInput: { email: '' },
        user: {}
    });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (!result.ok || !result.data || !result.data.success) {
        const errorMsg = result.data && result.data.message ? result.data.message : 'Login failed. Please check credentials.';
        return res.status(422).render('auth/login', {
            pageTitle: 'Login',
            currentPage: 'login',
            isLoggedIn: false,
            errors: [errorMsg],
            oldInput: { email },
            user: {}
        });
    }

    req.session.isLoggedIn = true;
    req.session.user = result.data.user;
    req.session.save(() => {
        res.redirect('/');
    });
});

app.get('/signup', (req, res) => {
    if (req.isLoggedIn) return res.redirect('/');
    res.render('auth/signup', {
        pageTitle: 'SignUp Page',
        currentPage: 'signUpPage',
        isLoggedIn: false,
        errors: [],
        oldInput: { firstName: '', lastName: '', email: '', userType: '', terms: '' },
        user: {}
    });
});

app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password, confirmPassword, userType, terms } = req.body;
    const result = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password, confirmPassword, userType, terms })
    });

    if (!result.ok || !result.data || !result.data.success) {
        const errors = (result.data && result.data.errors) ? result.data.errors : [(result.data && result.data.message) || 'Registration failed'];
        return res.status(422).render('auth/signup', {
            pageTitle: 'SignUp',
            currentPage: 'signup',
            isLoggedIn: false,
            errors: errors,
            oldInput: { firstName, lastName, email, userType, terms },
            user: {}
        });
    }

    res.redirect('/login');
});

app.post('/logout', async (req, res) => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ================= FAVOURITES ================= //

app.get('/favourite-list', async (req, res) => {
    if (!req.isLoggedIn || (req.session.user && req.session.user.userType !== 'guest')) {
        return res.redirect('/login');
    }
    const result = await apiFetch('/api/favourites', {
        headers: { 'x-user-id': req.session.user._id }
    });
    const favouriteHomes = result.data && result.data.favourites ? result.data.favourites : [];
    res.render('store/favourite-list', {
        favouriteHomes,
        pageTitle: 'My Favourites',
        currentPage: 'favourite-list',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.post('/favourite-list', async (req, res) => {
    if (!req.isLoggedIn || (req.session.user && req.session.user.userType !== 'guest')) {
        return res.redirect('/login');
    }
    await apiFetch('/api/favourites', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': req.session.user._id
        },
        body: JSON.stringify({ homeId: req.body.id })
    });
    res.redirect('/favourite-list');
});

app.post('/homes/delete-favourite/:homeId', async (req, res) => {
    if (!req.isLoggedIn || (req.session.user && req.session.user.userType !== 'guest')) {
        return res.redirect('/login');
    }
    await apiFetch(`/api/favourites/${req.params.homeId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': req.session.user._id }
    });
    res.redirect('/favourite-list');
});

// ================= BOOKINGS & RESERVATION ================= //

app.get('/bookings', async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    const result = await apiFetch('/api/bookings', {
        headers: { 'x-user-id': req.session.user._id }
    });
    const bookings = result.data && result.data.bookings ? result.data.bookings : [];
    res.render('store/bookings', {
        bookings,
        pageTitle: 'My Bookings',
        currentPage: 'bookings',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.get('/reserve/:homeId', async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    const result = await apiFetch(`/api/homes/${req.params.homeId}`);
    if (!result.ok || !result.data || !result.data.home) {
        return res.redirect('/homes');
    }
    res.render('store/reserve', {
        home: result.data.home,
        pageTitle: 'Reserve Home',
        currentPage: 'reserve',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.post('/reserve/:homeId', async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    const homeId = req.params.homeId;
    await apiFetch(`/api/bookings/reserve/${homeId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': req.session.user._id
        },
        body: JSON.stringify(req.body)
    });
    res.redirect('/bookings');
});

app.post('/bookings/cancel/:bookingId', async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    await apiFetch(`/api/bookings/${req.params.bookingId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': req.session.user._id }
    });
    res.redirect('/bookings');
});

// ================= USER PROFILE ================= //

app.get('/profile', async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    const result = await apiFetch('/api/profile', {
        headers: { 'x-user-id': req.session.user._id }
    });
    if (!result.ok || !result.data || !result.data.user) {
        return res.redirect('/');
    }
    res.render('store/profile', {
        userProfile: result.data.user,
        pageTitle: `${result.data.user.firstName}'s Profile`,
        currentPage: 'profile',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user,
        updated: req.query.updated === 'true'
    });
});

app.post(['/profile/edit', '/profile/change-password'], async (req, res) => {
    if (!req.isLoggedIn) return res.redirect('/login');

    const formData = new FormData();
    for (const key of Object.keys(req.body)) {
        formData.append(key, req.body[key]);
    }
    if (req.files && req.files.profilePic && req.files.profilePic[0]) {
        const file = req.files.profilePic[0];
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('profilePic', blob, file.originalname);
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/profile`, {
            method: 'PUT',
            headers: { 'x-user-id': req.session.user._id },
            body: formData
        });
        const data = await response.json().catch(() => null);
        if (data && data.user) {
            req.session.user = { ...req.session.user, ...data.user };
            await new Promise(r => req.session.save(r));
        }
        res.redirect('/profile?updated=true');
    } catch (err) {
        console.error('Error updating profile:', err);
        res.redirect('/profile');
    }
});

// ================= HOST ROUTES ================= //

app.use('/host', (req, res, next) => {
    if (!req.isLoggedIn) return res.redirect('/login');
    if (req.session.user && req.session.user.userType !== 'host') {
        return res.redirect('/');
    }
    next();
});

app.get(['/host/host-home-list', '/host/my-homes'], async (req, res) => {
    const result = await apiFetch('/api/host/homes', {
        headers: { 'x-user-id': req.session.user._id }
    });
    const registeredHomes = result.data && result.data.homes ? result.data.homes : [];
    res.render('host/host-home-list', {
        registeredHomes,
        pageTitle: 'My Homes',
        currentPage: 'host-homes',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.get('/host/add-home', (req, res) => {
    res.render('host/edit-home', {
        pageTitle: 'Add home to airbnb',
        currentPage: 'addHome',
        editing: false,
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.post('/host/add-home', async (req, res) => {
    const formData = new FormData();
    for (const key of Object.keys(req.body)) {
        formData.append(key, req.body[key]);
    }

    if (req.files && req.files['photo'] && req.files['photo'][0]) {
        const photoFile = req.files['photo'][0];
        const photoBlob = new Blob([photoFile.buffer], { type: photoFile.mimetype });
        formData.append('photo', photoBlob, photoFile.originalname);
    }

    if (req.files && req.files['rules'] && req.files['rules'][0]) {
        const rulesFile = req.files['rules'][0];
        const rulesBlob = new Blob([rulesFile.buffer], { type: rulesFile.mimetype });
        formData.append('rules', rulesBlob, rulesFile.originalname);
    }

    try {
        await fetch(`${BACKEND_URL}/api/host/homes`, {
            method: 'POST',
            headers: { 'x-user-id': req.session.user._id },
            body: formData
        });
        res.redirect('/host/host-home-list');
    } catch (err) {
        console.error('Error adding home:', err);
        res.redirect('/host/host-home-list');
    }
});

app.get('/host/edit-home/:homeId', async (req, res) => {
    const result = await apiFetch(`/api/host/homes/${req.params.homeId}`, {
        headers: { 'x-user-id': req.session.user._id }
    });
    if (!result.ok || !result.data || !result.data.home) {
        return res.redirect('/host/host-home-list');
    }
    res.render('host/edit-home', {
        home: result.data.home,
        pageTitle: 'Edit Your Home',
        currentPage: 'host-homes',
        editing: req.query.editing,
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.post('/host/edit-home', async (req, res) => {
    const homeId = req.body.id;
    const formData = new FormData();
    for (const key of Object.keys(req.body)) {
        formData.append(key, req.body[key]);
    }

    if (req.files && req.files['photo'] && req.files['photo'][0]) {
        const photoFile = req.files['photo'][0];
        const photoBlob = new Blob([photoFile.buffer], { type: photoFile.mimetype });
        formData.append('photo', photoBlob, photoFile.originalname);
    }

    if (req.files && req.files['rules'] && req.files['rules'][0]) {
        const rulesFile = req.files['rules'][0];
        const rulesBlob = new Blob([rulesFile.buffer], { type: rulesFile.mimetype });
        formData.append('rules', rulesBlob, rulesFile.originalname);
    }

    try {
        await fetch(`${BACKEND_URL}/api/host/homes/${homeId}`, {
            method: 'PUT',
            headers: { 'x-user-id': req.session.user._id },
            body: formData
        });
        res.redirect('/host/host-home-list');
    } catch (err) {
        console.error('Error editing home:', err);
        res.redirect('/host/host-home-list');
    }
});

app.post('/host/delete-home/:homeId', async (req, res) => {
    await apiFetch(`/api/host/homes/${req.params.homeId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': req.session.user._id }
    });
    res.redirect('/host/host-home-list');
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', {
        pageTitle: 'Page Not Found',
        currentPage: '404',
        isLoggedIn: req.isLoggedIn,
        user: req.session.user
    });
});

app.listen(PORT, () => {
    console.log(`Frontend server running on http://localhost:${PORT}`);
    console.log(`Connected to Backend API at: ${BACKEND_URL}`);
});

module.exports = app;
