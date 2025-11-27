// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, addDoc, deleteDoc, runTransaction, deleteField } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the platform
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = {
    apiKey: "AIzaSyA1w7fPrXlw_I9tZYvzBTOfLKoJvjNrjPY",
    authDomain: "krish-11166.firebaseapp.com",
    projectId: "krish-11166",
    storageBucket: "krish-11166.firebasestorage.app",
    messagingSenderId: "587101854752",
    appId: "1:587101854752:web:aa5e5e503fde6af3aaf045",
    measurementId: "G-BVV6JDQQYT"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let userId = null;
let userRole = null;
let userDocData = null;

// Admin UID - Hardcoded for a single admin user
const ADMIN_UID = 'sSGcrEx3vmcZHPbGCDpo9i8eQQG3';

// --- UTILITY FUNCTIONS ---
function showMessage(msg, type = 'success') {
    const container = document.getElementById('messageContainer');
    if (!container) return;
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = msg;
    container.appendChild(messageEl);
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateY(-20px)';
        setTimeout(() => messageEl.remove(), 300);
    }, 3000);
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) {
        sectionToShow.style.display = 'block';
        sectionToShow.classList.add('active');
    }

    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    sidebarBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.sidebar-btn[data-section="${sectionId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Function to validate student age
function isAgeEligible(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 15;
}

// --- AUTHENTICATION & INITIALIZATION ---
async function handleAuth() {
    showLoadingOverlay();
    if (initialAuthToken) {
        try {
            await signInWithCustomToken(auth, initialAuthToken);
        } catch (error) {
            console.error("Custom token sign-in failed.", error);
        }
    }
    hideLoadingOverlay();
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        showLoadingOverlay();
        try {
            const userDocRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                userDocData = userDoc.data();
                userRole = userDocData.role;
                console.log("User found with role:", userRole);
                const currentPath = window.location.pathname;

                if (userRole === 'student' && currentPath.includes('student.html')) {
                    setupStudentDashboard();
                } else if (userRole === 'company' && currentPath.includes('company.html')) {
                    setupCompanyDashboard();
                } else if (userRole === 'admin' && currentPath.includes('admin.html')) {
                    setupAdminDashboard();
                } else if (userRole === 'admin' && !currentPath.includes('admin.html')) {
                    console.log("Admin logged in from homepage, redirecting to admin.html");
                    window.location.href = 'admin.html';
                } else {
                    await signOut(auth);
                    console.log("Logged in user doesn't match page role, logging out.");
                }
            } else {
                console.warn("User document not found for UID:", userId);
                await signOut(auth);
            }
        } catch (error) {
            console.error("Error fetching user role:", error);
            await signOut(auth);
        } finally {
            hideLoadingOverlay();
        }
    } else {
        console.log("User is signed out.");
        const authSection = document.getElementById('authSection');
        if (authSection) authSection.style.display = 'flex';
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) dashboard.style.display = 'none';
        userId = null;
        userRole = null;
    }
});

// Register/Login Form Logic (for student/company)
const authForm = document.getElementById('authForm');
if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();
        const email = authForm.authEmail.value;
        const password = authForm.authPassword.value;
        const isRegistering = document.getElementById('authName').style.display !== 'none';
        const name = authForm.authName ? authForm.authName.value : '';

        try {
            if (isRegistering) {
                console.log("Attempting to register new user...");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const role = window.location.pathname.includes('student.html') ? 'student' : 'company';
                await setDoc(doc(db, 'users', user.uid), {
                    email,
                    role,
                    name,
                    createdAt: new Date(),
                    profile: {},
                    applications: {},
                    applications_recieved: {},
                    payments: {}
                });
                showMessage('Registration successful! Please login.');
                console.log("User registered and Firestore document created.");
                // We sign out here to trigger onAuthStateChanged to log in the correct user type on reload
                await signOut(auth); 
                window.location.reload();
            } else {
                console.log("Attempting to sign in existing user...");
                await signInWithEmailAndPassword(auth, email, password);
                console.log("User signed in successfully.");
            }
        } catch (error) {
            // Check for specific Auth errors like 'email-already-in-use'
            if (error.code === 'auth/email-already-in-use') {
                 showMessage('Error: This email is already registered. Please login instead.', 'error');
            } else {
                 showMessage(`Error: ${error.message}`, 'error');
            }
            console.error(error);
        } finally {
            hideLoadingOverlay();
        }
    });

    const toggleAuthLink = document.getElementById('toggleAuth');
    const authHeading = document.getElementById('authHeading');
    const authNameInput = document.getElementById('authName');
    const submitBtn = authForm.querySelector('button');
    if (toggleAuthLink && authHeading && authNameInput && submitBtn) {
        toggleAuthLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (authHeading.textContent.includes('Login')) {
                authHeading.textContent = authHeading.textContent.replace('Login', 'Register');
                authNameInput.style.display = 'block';
                toggleAuthLink.textContent = 'Login here';
                submitBtn.textContent = 'Register';
            } else {
                authHeading.textContent = authHeading.textContent.replace('Register', 'Login');
                authNameInput.style.display = 'none';
                toggleAuthLink.textContent = 'Register here';
                submitBtn.textContent = 'Login';
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("User logging out.");
            await signOut(auth);
            window.location.href = 'index.html';
        });
    }
}

// --- ADMIN LOGIN LOGIC FOR INDEX.HTML & ADMIN.HTML ---
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const adminAuthForm = document.getElementById('adminAuthForm');

if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
        if (adminLoginModal) adminLoginModal.style.display = 'flex';
    });
}
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (adminLoginModal) adminLoginModal.style.display = 'none';
    });
}
if (adminAuthForm) {
    adminAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();
        const email = adminAuthForm.adminEmail.value;
        const password = adminAuthForm.adminPassword.value;
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                console.log("Admin login successful. Redirecting to admin.html");
                if (window.location.pathname.includes('admin.html')) {
                    setupAdminDashboard();
                } else {
                    window.location.href = 'admin.html';
                }
            } else {
                await signOut(auth);
                showMessage('Access denied. This login is for administrators only.', 'error');
                console.warn("Login attempt failed: User is not an admin.");
            }
        } catch (error) {
            showMessage(`Error: ${error.message}`, 'error');
            console.error(error);
        } finally {
            hideLoadingOverlay();
            if (adminLoginModal) adminLoginModal.style.display = 'none';
        }
    });
}

// --- LANDING PAGE FUNCTIONS (INDEX.HTML) ---
async function loadLandingPageData() {
    showLoadingOverlay();
    try {
        const [adminDoc, companiesSnapshot] = await Promise.all([
            getDoc(doc(db, 'users', ADMIN_UID)),
            getDocs(query(collection(db, 'users'), where('role', '==', 'company'), where('profile.approved', '==', true))),
        ]);

        // CMS Content
        if (adminDoc.exists()) {
            const cmsData = adminDoc.data().cms || {};
            const heroTitleEl = document.querySelector('.hero-content h1');
            const heroDescriptionEl = document.querySelector('.hero-content p');
            if (heroTitleEl) heroTitleEl.textContent = cmsData.heroTitle || 'Unlock Your Future with a 15-Day Internship';
            if (heroDescriptionEl) heroDescriptionEl.textContent = cmsData.heroDescription || 'InternQuest connects 12th-pass students with valuable internships to gain real-world experience and boost their career.';
        }

        // Company List
        const companyListEl = document.getElementById('companyList');
        if (companyListEl) {
            companyListEl.innerHTML = '';
            companiesSnapshot.forEach(doc => {
                const company = doc.data();
                const companyCard = document.createElement('div');
                companyCard.className = 'company-card card';
                companyCard.innerHTML = `<h3>${company.name}</h3>`;
                companyListEl.appendChild(companyCard);
            });
        }

        // FAQ
        const faqContainer = document.getElementById('faqContainer');
        if (faqContainer) {
            const adminDocData = adminDoc.data();
            const faqs = adminDocData.faqs || {};
            faqContainer.innerHTML = '';
            for (const key in faqs) {
                const faq = faqs[key];
                const div = document.createElement('div');
                div.className = 'faq-item';
                div.innerHTML = `
                    <div class="faq-question">
                        <span>${faq.question}</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="faq-answer">
                        <p>${faq.answer}</p>
                    </div>
                `;
                div.addEventListener('click', () => {
                    div.classList.toggle('active');
                });
                faqContainer.appendChild(div);
            }
        }

        // Contact Form Handler
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                showLoadingOverlay();
                const name = contactForm.contactName.value;
                const email = contactForm.contactEmail.value;
                const message = contactForm.contactMessage.value;
                
                // Write message directly to Admin user document
                const adminDocRef = doc(db, 'users', ADMIN_UID);
                const messageId = Date.now().toString();

                try {
                    // This relies on the security rule allowing unauthenticated users to update the Admin document 
                    // only for adding a new field inside contactMessages
                    await updateDoc(adminDocRef, {
                         [`contactMessages.${messageId}`]: {
                            name,
                            email,
                            message,
                            timestamp: new Date().toISOString()
                        }
                    });
                    showMessage('Message sent successfully!', 'success');
                    contactForm.reset();
                } catch (error) {
                    console.error("Error submitting contact form:", error);
                    // Provide explicit advice for the permission error
                    showMessage('Failed to send message. Please ensure Firebase Security Rules allow unauthenticated users to write to the Admin document for contact messages.', 'error');
                }
                finally {
                    hideLoadingOverlay();
                }
            });
        }

    } catch (error) {
        console.error("Error loading landing page data. Check Firebase Security Rules for unauthenticated read access:", error);
        showMessage("Failed to load website content. Please inform the administrator.", "error");
    } finally {
        hideLoadingOverlay();
    }
}

// --- STUDENT DASHBOARD FUNCTIONS ---
async function setupStudentDashboard() {
    console.log("Setting up student dashboard...");
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'flex';
    document.getElementById('studentName').textContent = `Hi, ${userDocData.name}`;

    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    sidebarBtns.forEach(btn => btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
    }));

    showSection('profile');

    loadStudentProfile();
    setupAptitudeTest();
    loadAvailableInternships();
    loadStudentApplications();
    setupPaymentSection();
    loadEnrolledCompany();
}

async function loadStudentProfile() {
    const profileForm = document.getElementById('profileForm');
    const studentStreamInput = document.getElementById('studentStreamInput');
    const studentOtherStreamInput = document.getElementById('studentOtherStreamInput');

    if (!profileForm || !studentStreamInput || !studentOtherStreamInput) return;

    studentStreamInput.addEventListener('change', () => {
        if (studentStreamInput.value === 'Others') {
            studentOtherStreamInput.style.display = 'block';
            studentOtherStreamInput.setAttribute('required', 'required');
        } else {
            studentOtherStreamInput.style.display = 'none';
            studentOtherStreamInput.removeAttribute('required');
        }
    });

    const data = userDocData.profile || {};
    profileForm.studentNameInput.value = userDocData.name;
    profileForm.studentEmailInput.value = userDocData.email;
    profileForm.studentPhoneInput.value = data.phone || '';
    profileForm.studentDobInput.value = data.dob || '';
    profileForm.studentAddressInput.value = data.address || '';
    profileForm.studentMarksInput.value = data.marks || '';
    profileForm.bankNameInput.value = data.bankName || '';
    profileForm.accountHolderNameInput.value = data.accountHolderName || '';
    profileForm.accountNumberInput.value = data.accountNumber || '';
    profileForm.bankBranchInput.value = data.bankBranch || '';
    profileForm.ifscCodeInput.value = data.ifscCode || '';

    if (data.stream) {
        const standardStreams = ['Science', 'Commerce', 'Arts'];
        if (standardStreams.includes(data.stream)) {
            studentStreamInput.value = data.stream;
        } else {
            studentStreamInput.value = 'Others';
            studentOtherStreamInput.style.display = 'block';
            studentOtherStreamInput.value = data.stream;
        }
    }


    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();

        const dob = profileForm.studentDobInput.value;
        if (!dob || !isAgeEligible(dob)) {
            showMessage('You must provide a valid Date of Birth and be at least 15 years old.', 'error');
            hideLoadingOverlay();
            return;
        }

        const stream = studentStreamInput.value === 'Others' ? studentOtherStreamInput.value : studentStreamInput.value;
        if (!stream) {
            showMessage('Please select or specify your 12th stream.', 'error');
            hideLoadingOverlay();
            return;
        }

        const bankDetailsComplete = profileForm.bankNameInput.value &&
            profileForm.accountHolderNameInput.value &&
            profileForm.accountNumberInput.value &&
            profileForm.bankBranchInput.value &&
            profileForm.ifscCodeInput.value;

        if (!bankDetailsComplete) {
            showMessage('All bank details are mandatory and must be filled.', 'error');
            hideLoadingOverlay();
            return;
        }

        const data = {
            phone: profileForm.studentPhoneInput.value,
            dob: dob,
            address: profileForm.studentAddressInput.value,
            stream: stream,
            marks: parseInt(profileForm.studentMarksInput.value),
            bankName: profileForm.bankNameInput.value,
            accountHolderName: profileForm.accountHolderNameInput.value,
            accountNumber: profileForm.accountNumberInput.value,
            bankBranch: profileForm.bankBranchInput.value,
            ifscCode: profileForm.ifscCodeInput.value
        };
        await updateDoc(doc(db, 'users', userId), { profile: data, name: profileForm.studentNameInput.value });
        showMessage('Profile updated successfully!');
        hideLoadingOverlay();
    });
}

async function setupAptitudeTest() {
    const testContainer = document.getElementById('testContainer');
    const startTestBtn = document.getElementById('startTestBtn');
    const testResult = document.getElementById('testResult');
    const profileData = userDocData.profile || {};

    if (!testContainer || !testResult) return;

    const requiredFields = ['name', 'phone', 'dob', 'address', 'stream', 'marks', 'bankName', 'accountHolderName', 'accountNumber', 'bankBranch', 'ifscCode'];

    const isProfileComplete = requiredFields.every(field => {
        if (field === 'name') {
            return userDocData[field] && userDocData[field] !== '';
        } else {
            return profileData[field] && profileData[field] !== '';
        }
    });

    if (!isProfileComplete) {
        testContainer.innerHTML = `
            <h3>Profile Incomplete</h3>
            <p>Please complete **all mandatory profile details** (including Bank Details) in the 'My Profile' section before proceeding.</p>
            <button class="btn btn-primary" id="goToProfileBtn">Go to Profile</button>
        `;
        document.getElementById('goToProfileBtn').addEventListener('click', () => {
            showSection('profile');
        });
        return;
    }

    const attempts = profileData.aptitudeAttempts || 0;
    const isPassed = profileData.aptitudeScore !== undefined && profileData.aptitudeScore >= 12;

    if (isPassed) {
        testContainer.innerHTML = '';
        if (testResult) {
            testResult.style.display = 'block';
            document.getElementById('testScore').textContent = profileData.aptitudeScore;
            document.getElementById('testStatus').textContent = 'Congratulations! You passed the test.';
        }
        return;
    }

    if (attempts >= 3) {
        testContainer.innerHTML = `
            <h3>Test Attempts Exhausted</h3>
            <p>You have used all 3 of your attempts. Your final score was: ${profileData.aptitudeScore || 'N/A'}/15.</p>
        `;
        return;
    }

    testContainer.innerHTML = `
        <div class="test-intro">
            <h3>Instructions</h3>
            <p>You have 10 minutes to complete the test. There are 15 multiple-choice questions.</p>
            <p>You must score at least 12 correct answers to be eligible for internships.</p>
            <p>You have ${3 - attempts} attempt(s) remaining.</p>
            <button id="startTestBtn" class="btn btn-primary">Start Test</button>
        </div>
    `;
    const newStartTestBtn = document.getElementById('startTestBtn');
    if (!newStartTestBtn) return;

    newStartTestBtn.addEventListener('click', async () => {
        showLoadingOverlay();
        testContainer.innerHTML = '<h3>Loading questions...</h3>';
        try {
            const adminDoc = await getDoc(doc(db, 'users', ADMIN_UID));
            const allQuestions = Object.values(adminDoc.data().questions || {});

            const selectedQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 15);
            let timerInterval;
            let timeRemaining = 10 * 60;
            let currentQuestion = 0;
            const totalQuestions = selectedQuestions.length;
            const studentAnswers = Array(totalQuestions).fill(null);

            const updateTimer = () => {
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;
                const timerEl = document.getElementById('testTimer');
                if (timerEl) {
                    timerEl.innerHTML = `<i class="fas fa-clock"></i> ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            };

            const submitTest = async () => {
                clearInterval(timerInterval);
                let score = 0;
                for (let i = 0; i < totalQuestions; i++) {
                    if (studentAnswers[i] === selectedQuestions[i].correctOption) {
                        score++;
                    }
                }

                const newAttempts = attempts + 1;
                const updateData = { 'profile.aptitudeAttempts': newAttempts, 'profile.aptitudeScore': score };
                await updateDoc(doc(db, 'users', userId), updateData);

                testContainer.innerHTML = '';
                if (testResult) {
                    testResult.style.display = 'block';
                    document.getElementById('testScore').textContent = score;
                    document.getElementById('testStatus').textContent = score >= 12 ? 'Congratulations! You passed the test.' : 'You did not pass. Try again later.';
                }
                hideLoadingOverlay();
            };

            const renderQuestion = () => {
                if (currentQuestion >= totalQuestions) {
                    submitTest();
                    return;
                }

                const q = selectedQuestions[currentQuestion];
                testContainer.innerHTML = `
                    <div class="question card">
                        <div class="test-header">
                            <h4>Q${currentQuestion + 1} of ${totalQuestions}: ${q.question}</h4>
                            <div id="testTimer" class="timer">10:00</div>
                        </div>
                        <div class="options">
                            <label>
                                <input type="radio" name="answer" value="A" class="cursor-pointer">
                                ${q.optionA}
                            </label>
                            <label>
                                <input type="radio" name="answer" value="B" class="cursor-pointer">
                                ${q.optionB}
                            </label>
                            <label>
                                <input type="radio" name="answer" value="C" class="cursor-pointer">
                                ${q.optionC}
                            </label>
                        </div>
                        <div class="test-navigation">
                            <button id="prevBtn" class="btn btn-secondary" ${currentQuestion === 0 ? 'disabled' : ''}>Previous</button>
                            <button id="nextBtn" class="btn btn-primary">${currentQuestion === totalQuestions - 1 ? 'Submit' : 'Next'}</button>
                        </div>
                    </div>
                `;

                if (studentAnswers[currentQuestion]) {
                    const selectedInput = document.querySelector(`input[name="answer"][value="${studentAnswers[currentQuestion]}"]`);
                    if (selectedInput) {
                        selectedInput.checked = true;
                    }
                }

                const prevBtn = document.getElementById('prevBtn');
                const nextBtn = document.getElementById('nextBtn');

                if (prevBtn) {
                    prevBtn.addEventListener('click', () => {
                        const selected = document.querySelector('input[name="answer"]:checked');
                        if (selected) {
                            studentAnswers[currentQuestion] = selected.value;
                        }
                        currentQuestion--;
                        renderQuestion();
                    });
                }

                nextBtn.addEventListener('click', () => {
                    const selected = document.querySelector('input[name="answer"]:checked');
                    if (selected) {
                        studentAnswers[currentQuestion] = selected.value;
                        currentQuestion++;
                        renderQuestion();
                    } else {
                        showMessage('Please select an answer.', 'error');
                    }
                });

                updateTimer();
            };

            timerInterval = setInterval(() => {
                if (timeRemaining <= 0) {
                    submitTest();
                } else {
                    timeRemaining--;
                    updateTimer();
                }
            }, 1000);

            renderQuestion();

        } catch (error) {
            console.error("Error loading aptitude questions:", error);
            showMessage("Failed to load test questions. Please try again later.", "error");
        } finally {
            hideLoadingOverlay();
        }
    });
}

async function loadAvailableInternships() {
    const internshipsSection = document.getElementById('internships');
    if (!internshipsSection || !userDocData) return; // Added null check

    showLoadingOverlay();
    try {
        const aptitudeScore = userDocData.profile?.aptitudeScore;
        const attempts = userDocData.profile?.aptitudeAttempts || 0;
        const isEligible = aptitudeScore !== undefined && aptitudeScore >= 12;

        if (!isEligible) {
            let message = '';
            if (attempts >= 3) {
                message = `You have used all 3 attempts for the Aptitude Test and are no longer eligible to apply for internships. Your highest score was: ${aptitudeScore !== undefined ? aptitudeScore : 'N/A'}/15`;
            } else {
                message = `You must pass the Aptitude Test with a score of 12/15 to view and apply for internships. Your current score is: ${aptitudeScore !== undefined ? aptitudeScore : 'N/A'}/15`;
            }

            internshipsSection.innerHTML = `
                <h2>Available Internships</h2>
                <div class="card p-4 text-center">
                    <h3>Eligibility Required</h3>
                    <p>${message}</p>
                    ${attempts < 3 ? `<button class="btn btn-primary mt-4" id="goToAptitudeBtn">Go to Aptitude Test</button>` : ''}
                </div>
            `;
            const goToAptitudeBtn = document.getElementById('goToAptitudeBtn');
            if (goToAptitudeBtn) {
                goToAptitudeBtn.addEventListener('click', () => showSection('aptitudeTest'));
            }
            hideLoadingOverlay();
            return;
        }

        internshipsSection.innerHTML = `<h2>Available Internships</h2><div id="internshipList"></div>`;
        const updatedInternshipList = document.getElementById('internshipList');

        const [internshipsSnapshot, companiesSnapshot] = await Promise.all([
            getDocs(collection(db, 'internships')),
            getDocs(query(collection(db, 'users'), where('role', '==', 'company'), where('profile.approved', '==', true)))
        ]);

        const companiesData = {};
        companiesSnapshot.forEach(doc => companiesData[doc.id] = doc.data());

        const appliedInternshipIds = (userDocData && userDocData.applications) ? Object.keys(userDocData.applications) : [];

        updatedInternshipList.innerHTML = '';
        internshipsSnapshot.forEach(doc => {
            const internship = doc.data();
            const company = companiesData[internship.companyId];
            if (company && !appliedInternshipIds.includes(doc.id)) {
                const internshipCard = document.createElement('div');
                internshipCard.className = 'internship-card card';

                let buttonHtml = `<button class="btn btn-primary apply-btn" data-internship-id="${doc.id}" data-company-id="${internship.companyId}">Apply Now</button>`;

                internshipCard.innerHTML = `
                    <h3>${internship.title}</h3>
                    <p><strong>Company:</strong> ${company.name}</p>
                    <p>${internship.description}</p>
                    ${buttonHtml}
                `;
                updatedInternshipList.appendChild(internshipCard);
            }
        });

        if (updatedInternshipList) {
             updatedInternshipList.addEventListener('click', async (e) => {
                if (e.target.classList.contains('apply-btn')) {
                    showLoadingOverlay();
                    const internshipId = e.target.dataset.internshipId;
                    const companyId = e.target.dataset.companyId;

                    const applicationData = {
                        internshipId,
                        companyId,
                        status: 'Applied',
                        appliedAt: new Date().toISOString()
                    };

                    // Use transaction for atomic updates
                    const studentRef = doc(db, 'users', userId);
                    const adminRef = doc(db, 'users', ADMIN_UID);
                    const appKey = `${internshipId}_${userId}`;

                    try {
                        await runTransaction(db, async (transaction) => {
                            const studentDoc = await transaction.get(studentRef);
                            const adminDoc = await transaction.get(adminRef);

                            if (!studentDoc.exists() || !adminDoc.exists()) throw "Document does not exist!";

                            const studentApplications = studentDoc.data().applications || {};
                            studentApplications[internshipId] = applicationData;

                            const adminPendingApps = adminDoc.data().pending_applications || {};
                            adminPendingApps[appKey] = {
                                studentId: userId,
                                companyId: companyId,
                                internshipId: internshipId,
                                status: 'Pending Admin Approval',
                                appliedAt: new Date().toISOString()
                            };

                            transaction.update(studentRef, { applications: studentApplications });
                            transaction.update(adminRef, { pending_applications: adminPendingApps });
                        });
                        showMessage('Application submitted successfully! Awaiting admin approval.');
                    } catch (error) {
                        console.error("Application submission failed:", error);
                        showMessage(`Application submission failed: ${error.message}`, "error");
                    } finally {
                        hideLoadingOverlay();
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error loading internships:", error);
        showMessage("Failed to load internships. Check network/permissions.", "error");
    } finally {
        hideLoadingOverlay();
    }
}

async function loadStudentApplications() {
    const myApplicationsList = document.getElementById('myApplicationsList');
    const paymentSidebarBtn = document.getElementById('paymentSidebarBtn');
    
    // FIX: Check userDocData availability to prevent crash
    if (!myApplicationsList || !paymentSidebarBtn || !userDocData) return; 

    onSnapshot(doc(db, 'users', userId), async (userDoc) => {
        userDocData = userDoc.data();
        const applications = userDocData.applications || {};
        myApplicationsList.innerHTML = '';

        let hasSelectedApplication = false;

        const internships = await getDocs(collection(db, 'internships'));
        const internshipsMap = {};
        internships.forEach(d => internshipsMap[d.id] = d.data());

        const promises = Object.keys(applications).map(async appKey => {
            const appData = applications[appKey];
            const internship = internshipsMap[appData.internshipId];
            if (!internship) return null;
            
            // Defensive fetching of company data
            try {
                const companyDoc = await getDoc(doc(db, 'users', appData.companyId));
                const company = companyDoc.data();
                return { appData, internship, company, appKey };
            } catch (error) {
                console.error(`Permission Error accessing Company ${appData.companyId} for application ${appKey}:`, error);
                return null;
            }
        });

        const results = (await Promise.all(promises)).filter(item => item !== null);

        results.forEach(({ appData, internship, company, appKey }) => {
            if (appData.status !== 'Completed' && appData.status !== 'Ongoing' && appData.status !== 'Payment Complete' && appData.status !== 'Offer Letter Issued' && appData.status !== 'Rejected') {
                const applicationCard = document.createElement('div');
                applicationCard.className = `application-card card status-${appData.status.toLowerCase().replace(/ /g, '')}`;
                applicationCard.innerHTML = `
                    <h4>${internship.title}</h4>
                    <p><strong>Company:</strong> ${company.name}</p>
                    <p><strong>Status:</strong> ${appData.status}</p>
                `;
                if (appData.status === 'Rejected' && appData.rejectionReason) {
                    applicationCard.innerHTML += `<p><strong>Reason:</strong> ${appData.rejectionReason}</p>`;
                }

                if (appData.status === 'Selected' && !appData.paymentMade) {
                    hasSelectedApplication = true;
                    const payBtn = document.createElement('button');
                    payBtn.className = 'btn btn-primary';
                    payBtn.textContent = 'Go to Payment';
                    payBtn.addEventListener('click', () => {
                        showSection('payment');
                        document.getElementById('internshipTitlePayment').textContent = internship.title;
                        document.getElementById('companyNamePayment').textContent = company.name;
                        document.getElementById('payNowBtn').dataset.applicationId = appData.internshipId;
                    });
                    applicationCard.appendChild(payBtn);
                }
                myApplicationsList.appendChild(applicationCard);
            }
        });

        if (hasSelectedApplication) {
            paymentSidebarBtn.style.display = 'block';
        } else {
            paymentSidebarBtn.style.display = 'none';
        }

        if (myApplicationsList.innerHTML === '') {
            myApplicationsList.innerHTML = '<p>You have no pending applications.</p>';
        }
    });
}

async function loadEnrolledCompany() {
    const enrolledCompanyList = document.getElementById('enrolledCompanyList');
    const enrolledCompanyBtn = document.getElementById('enrolledCompanyBtn');

    // FIX: Check userDocData availability to prevent crash
    if (!enrolledCompanyList || !enrolledCompanyBtn || !userDocData) return; 

    onSnapshot(doc(db, 'users', userId), async (userDoc) => {
        userDocData = userDoc.data();
        const applications = userDocData.applications || {};
        enrolledCompanyList.innerHTML = '';

        const internships = await getDocs(collection(db, 'internships'));
        const internshipsMap = {};
        internships.forEach(d => internshipsMap[d.id] = d.data());

        let hasEnrolledInternship = false;

        const promises = Object.keys(applications).map(async appKey => {
            const appData = applications[appKey];
            if (['Ongoing', 'Completed', 'Payment Complete', 'Offer Letter Issued'].includes(appData.status)) {
                const internship = internshipsMap[appData.internshipId];
                
                // Defensive fetching of company data
                try {
                    const companyDoc = await getDoc(doc(db, 'users', appData.companyId));
                    const company = companyDoc.data();
                    if (!internship || !company) return null;
                    return { appData, internship, company, appKey };
                } catch (error) {
                    console.error(`Permission Error accessing Company ${appData.companyId} for enrolled app ${appKey}:`, error);
                    return null;
                }
            }
            return null;
        });

        const results = (await Promise.all(promises)).filter(item => item !== null);

        results.forEach(({ appData, internship, company, appKey }) => {
            hasEnrolledInternship = true;
            const enrolledCard = document.createElement('div');
            enrolledCard.className = `application-card card status-${appData.status.toLowerCase().replace(/ /g, '')}`;
            enrolledCard.innerHTML = `
                <h4>${internship.title}</h4>
                <p><strong>Company:</strong> ${company.name}</p>
                <p><strong>Status:</strong> ${appData.status}</p>
            `;

            if (appData.status === 'Offer Letter Issued') {
                const offerLetterBtn = document.createElement('button');
                offerLetterBtn.className = 'btn btn-primary';
                offerLetterBtn.textContent = 'Download Offer Letter';
                offerLetterBtn.addEventListener('click', async () => {
                    showLoadingOverlay();
                    try {
                        const studentDoc = await getDoc(doc(db, 'users', userId));
                        const studentData = studentDoc.data();
                        const companyDoc = await getDoc(doc(db, 'users', appData.companyId));
                        const companyData = companyDoc.data();
                        // PASS appData to generateOfferLetterPDF
                        await generateOfferLetterPDF(studentData, internship, companyData, appData);
                        showMessage('Offer letter downloaded successfully!');
                    } catch (err) {
                        console.error("Failed to generate offer letter:", err);
                        showMessage("Failed to generate offer letter.", "error");
                    } finally {
                        hideLoadingOverlay();
                    }
                });
                enrolledCard.appendChild(offerLetterBtn);

                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'btn btn-primary ml-2';
                acceptBtn.textContent = 'Accept Offer';
                acceptBtn.addEventListener('click', async () => {
                    showLoadingOverlay();
                    const appKey = `${appData.internshipId}_${userId}`;
                    await updateDoc(doc(db, 'users', userId), { [`applications.${appData.internshipId}.status`]: 'Ongoing' });
                    await updateDoc(doc(db, 'users', appData.companyId), { [`applications_recieved.${appKey}.status`]: 'Ongoing' });
                    showMessage('Offer accepted! You are now an ongoing intern.');
                    hideLoadingOverlay();
                });
                enrolledCard.appendChild(acceptBtn);

                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'btn btn-secondary ml-2';
                rejectBtn.textContent = 'Reject Offer';
                rejectBtn.addEventListener('click', async () => {
                    showLoadingOverlay();
                    const rejectionReason = prompt("Please provide a reason for rejecting the offer:");
                    if (rejectionReason) {
                        const appKey = `${appData.internshipId}_${userId}`;
                        await updateDoc(doc(db, 'users', userId), { [`applications.${appData.internshipId}.status`]: 'Rejected', [`applications.${appData.internshipId}.rejectionReason`]: rejectionReason });
                        await updateDoc(doc(db, 'users', appData.companyId), { [`applications_recieved.${appKey}.status`]: 'Rejected' });
                        showMessage('Offer rejected.');
                    } else {
                        showMessage('Offer rejection cancelled.', 'error');
                    }
                    hideLoadingOverlay();
                });
                enrolledCard.appendChild(rejectBtn);
            }

            if (appData.status === 'Completed') {
                const certBtn = document.createElement('button');
                certBtn.className = 'btn btn-primary';
                certBtn.textContent = 'Download Certificate';
                certBtn.addEventListener('click', async () => {
                    showLoadingOverlay();
                    try {
                        const studentDoc = await getDoc(doc(db, 'users', userId));
                        const studentData = studentDoc.data();
                        const companyDoc = await getDoc(doc(db, 'users', appData.companyId));
                        const companyData = companyDoc.data();
                        const internshipDoc = await getDoc(doc(db, 'internships', appData.internshipId));
                        const internshipData = internshipDoc.data();

                        if (!studentData?.profile || !companyData || !internshipData) {
                            throw new Error("Failed to retrieve complete data for PDF generation.");
                        }

                        await generateCertificatePDF(studentData, internshipData, companyData);
                        showMessage('Certificate downloaded successfully!');
                    } catch (err) {
                        console.error("Failed to generate certificate:", err);
                        showMessage("Failed to generate certificate.", "error");
                    } finally {
                        hideLoadingOverlay();
                    }
                });
                enrolledCard.appendChild(certBtn);
            }
            if (appData.paymentId) { // Check if paymentId exists (meaning payment is complete)
                const receiptBtn = document.createElement('button');
                receiptBtn.className = 'btn btn-secondary mt-2';
                receiptBtn.textContent = 'Download Payment Receipt';
                receiptBtn.addEventListener('click', async () => {
                    showLoadingOverlay();
                    try {
                        const studentDoc = await getDoc(doc(db, 'users', userId));
                        const studentData = studentDoc.data();
                        const companyDoc = await getDoc(doc(db, 'users', appData.companyId));
                        const companyData = companyDoc.data();
                        const internshipDoc = await getDoc(doc(db, 'internships', appData.internshipId));
                        const internshipData = internshipDoc.data();
                        const adminDoc = await getDoc(doc(db, 'users', ADMIN_UID));
                        const adminPayments = adminDoc.data().payments || {};
                        const appKey = `${appData.internshipId}_${userId}`;
                        const paymentRecord = adminPayments[appKey];

                        if (!studentData || !companyData || !internshipData || !paymentRecord) {
                            throw new Error("Missing data for PDF generation.");
                        }

                        await generatePaymentReceiptPDF(studentData, internshipData, companyData, paymentRecord.paymentId);
                        showMessage('Payment receipt downloaded successfully!');
                    } catch (err) {
                        console.error("Failed to generate payment receipt:", err);
                        showMessage("Failed to generate payment receipt.", "error");
                    } finally {
                        hideLoadingOverlay();
                    }
                });
                enrolledCard.appendChild(receiptBtn);
            }

            enrolledCompanyList.appendChild(enrolledCard);
        });
        enrolledCompanyBtn.style.display = hasEnrolledInternship ? 'block' : 'none';

        if (enrolledCompanyList.innerHTML === '') {
            enrolledCompanyList.innerHTML = '<p>You have not been enrolled in any internships yet.</p>';
        }
    });
}


function setupPaymentSection() {
    const payNowBtn = document.getElementById('payNowBtn');
    if (!payNowBtn || !userDocData) return; // Added null check

    payNowBtn.addEventListener('click', async () => {
        showLoadingOverlay();
        const internshipId = payNowBtn.dataset.applicationId;
        const appData = userDocData.applications[internshipId];
        const appKey = `${internshipId}_${userId}`;

        const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        try {
            await runTransaction(db, async (transaction) => {
                const studentRef = doc(db, 'users', userId);
                const companyRef = doc(db, 'users', appData.companyId);
                const adminRef = doc(db, 'users', ADMIN_UID);

                const studentDoc = await transaction.get(studentRef);
                const companyDoc = await transaction.get(companyRef);
                const adminDoc = await transaction.get(adminRef);

                if (!studentDoc.exists() || !companyDoc.exists() || !adminDoc.exists()) {
                    throw "Document does not exist!";
                }

                const studentApps = studentDoc.data().applications || {};
                const companyApps = companyDoc.data().applications_recieved || {};
                const adminPayments = adminDoc.data().payments || {};

                // --- START PAYMENT AUTOMATION ---
                // Student application update
                studentApps[internshipId].paymentMade = true;
                studentApps[internshipId].status = 'Payment Complete'; // Direct to Complete
                studentApps[internshipId].paymentId = paymentId;
                
                // Company application update
                if (companyApps[appKey]) {
                    companyApps[appKey].status = 'Payment Complete'; // Direct to Complete
                }

                // Admin payments record
                adminPayments[appKey] = {
                    studentId: userId,
                    companyId: appData.companyId,
                    internshipId: internshipId,
                    amount: 149,
                    status: 'Complete', // Direct to Complete
                    paymentId: paymentId,
                    date: new Date().toISOString()
                };
                // --- END PAYMENT AUTOMATION ---

                transaction.update(studentRef, { applications: studentApps });
                transaction.update(companyRef, { applications_recieved: companyApps });
                transaction.update(adminRef, { payments: adminPayments });
            });

            // After transaction success:
            showMessage(`Payment successful! Your unique Payment ID is ${paymentId}. You can now download your receipt and await the Offer Letter.`, 'success');
        } catch (error) {
            console.error("Transaction failed:", error);
            showMessage(`Payment failed: ${error.message}`, "error");
        } finally {
            hideLoadingOverlay();
        }
    });
}

// --- PDF GENERATION FUNCTIONS ---

function getBase64Image(imgUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = (e) => {
            console.error("Failed to load image:", imgUrl, e);
            reject(new Error(`Failed to load image at ${imgUrl}`));
        };
        img.src = imgUrl;
        img.crossOrigin = 'Anonymous';
    });
}

async function generateOfferLetterPDF(studentData, internshipData, companyData, appData) {
    const doc = new window.jspdf.jsPDF();

    if (!studentData?.name || !internshipData?.title || !companyData?.name || !appData?.appliedAt) {
        throw new Error("Missing critical data for PDF generation (name, title, or applied date).");
    }

    let logoDataUrl = null;
    let signatureDataUrl = null;

    try {
        logoDataUrl = await getBase64Image('logo.jpg');
        doc.addImage(logoDataUrl, 'JPEG', 15, 10, 40, 20);
    } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(42, 111, 219);
        doc.text('InternQuest', 15, 20);
        console.warn("Using fallback text for logo in Offer Letter:", e.message);
    }

    try {
        signatureDataUrl = await getBase64Image('sign.jpg');
    } catch (e) {
        console.warn("Could not load CEO signature (sign.jpg):", e.message);
    }

    doc.setLineWidth(0.5);
    doc.setDrawColor(42, 111, 219);
    doc.line(10, 35, 200, 35);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 195, 20, null, null, 'right');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(42, 111, 219);
    doc.text('OFFICIAL INTERNSHIP OFFER', 105, 50, null, null, 'center');

    // FIX: Use the directly passed appData instead of studentData.applications[internshipData.id]
    // const appData = studentData.applications[internshipData.id]; 

    const startDate = new Date(appData.appliedAt);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 15);

    const startDateString = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const endDateString = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(12);

    let y = 70;
    doc.text(`[Ref: OL-${Date.now()}]`, 20, y);
    y += 10;
    doc.text(`Dear ${studentData.name},`, 20, y);
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Subject: Offer of Internship for the position of ' + internshipData.title, 20, y);
    doc.setFont('helvetica', 'normal');
    y += 15;

    const content = `
We are delighted to confirm your selection for a 15-day virtual internship with ${companyData.name} for the position of ${internshipData.title}.

This opportunity is designed to provide you with valuable practical experience and a deep understanding of industry operations, supporting your career development.

Your internship is scheduled to commence on ${startDateString} and conclude on ${endDateString}.

We look forward to your positive contribution to the ${companyData.name} team. Please confirm your acceptance by engaging with the appropriate button on your dashboard.
`;

    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    const contentLines = doc.splitTextToSize(content, 170);
    doc.text(contentLines, 20, y);
    y += (contentLines.length * 5) + 5;

    if (signatureDataUrl) {
        doc.addImage(signatureDataUrl, 'JPEG', 20, y, 40, 15);
    }
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Sincerely,`, 20, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`InternQuest CEO`, 20, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`on behalf of ${companyData.name}`, 20, y);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a digitally generated document. Unauthorized alteration is strictly prohibited.", 105, 290, null, null, 'center');

    doc.save(`Offer_Letter_${studentData.name}.pdf`);
}

async function generateCertificatePDF(studentData, internshipData, companyData) {
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', format: 'a4' });

    if (!studentData?.name || !internshipData?.title || !companyData?.name) {
        throw new Error("Missing data for PDF generation.");
    }

    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 297, 210, 'F');
    doc.setDrawColor(42, 111, 219);
    doc.setLineWidth(4);
    doc.rect(10, 10, 277, 190);
    doc.setDrawColor(240, 140, 0);
    doc.setLineWidth(1);
    doc.rect(15, 15, 267, 180);

    try {
        const logoDataUrl = await getBase64Image('logo.jpg');
        doc.addImage(logoDataUrl, 'JPEG', 135, 20, 25, 12);
    } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(42, 111, 219);
        doc.text('InternQuest', 148, 28, null, null, 'center');
        console.warn("Using fallback text for logo in Certificate:", e.message);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(40);
    doc.setTextColor(51, 65, 85);
    doc.text('CERTIFICATE OF COMPLETION', 148, 55, null, null, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(100, 100, 100);
    doc.text('PROUDLY PRESENTED TO', 148, 75, null, null, 'center');

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(36);
    doc.setTextColor(42, 111, 219);
    doc.text(studentData.name.toUpperCase(), 148, 100, null, null, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(51, 65, 85);
    doc.text('FOR SUCCESSFULLY COMPLETING A 15-DAY INTERNSHIP IN THE ROLE OF', 148, 115, null, null, 'center');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(0, 0, 0);
    doc.text(internshipData.title.toUpperCase(), 148, 135, null, null, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text(`AT ${companyData.name.toUpperCase()}`, 148, 150, null, null, 'center');

    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    let signatureDataUrl = null;
    try {
        signatureDataUrl = await getBase64Image('sign.jpg');
        doc.addImage(signatureDataUrl, 'JPEG', 225, 160, 30, 15);
    } catch (e) {
        console.warn("Could not load CEO signature (sign.jpg) for Certificate:", e.message);
    }

    doc.text('Digital Signature / CEO', 240, 185, null, null, 'center');
    doc.text('Date of Issue: ' + issueDate, 40, 185);

    doc.save('InternQuest_Certificate.pdf');
}

async function generatePaymentReceiptPDF(studentData, internshipData, companyData, paymentId) {
    const doc = new window.jspdf.jsPDF();

    if (!studentData?.name || !internshipData?.title || !companyData?.name) {
        throw new Error("Missing data for PDF generation.");
    }
    
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setDrawColor(42, 111, 219);
    doc.setLineWidth(1);
    doc.rect(10, 10, 190, 277, 'S');

    try {
        const logoDataUrl = await getBase64Image('logo.jpg');
        doc.addImage(logoDataUrl, 'JPEG', 15, 15, 30, 15);
    } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(42, 111, 219);
        doc.text('InternQuest', 15, 25);
        console.warn("Using fallback text for logo in Receipt:", e.message);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(42, 111, 219);
    doc.text('Payment Receipt', 195, 25, null, null, 'right');
    doc.setLineWidth(0.5);
    doc.line(15, 35, 195, 35);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);

    let y = 45;
    doc.text(`Receipt ID: ${paymentId}`, 15, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 195, y, null, null, 'right');
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PAYMENT CONFIRMATION', 15, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('This receipt confirms the successful payment for your internship application.', 15, y);
    y += 15;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(235, 235, 235);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text('DESCRIPTION', 20, y + 5);
    doc.text('AMOUNT (₹)', 185, y + 5, null, null, 'right');
    y += 8;

    doc.setFillColor(255, 255, 255);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.text(`Application/Enrollment Fee for ${internshipData.title} at ${companyData.name}`, 20, y + 5);
    doc.text('149', 185, y + 5, null, null, 'right');
    y += 10;

    doc.setLineWidth(0.2);
    doc.line(15, y, 195, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL PAID:', 150, y + 5);
    doc.setTextColor(42, 111, 219);
    doc.text('₹149', 195, y + 5, null, null, 'right');
    y += 20;

    let signatureDataUrl = null;
    try {
        signatureDataUrl = await getBase64Image('sign.jpg');
        doc.addImage(signatureDataUrl, 'JPEG', 15, y, 30, 10);
    } catch (e) {
        console.warn("Could not load CEO signature (sign.jpg) for Receipt:", e.message);
    }
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('CEO Signature', 15, y);


    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your payment. This confirms your eligibility to receive the official Offer Letter.', 105, 280, null, null, 'center');

    doc.save(`Payment_Receipt_${paymentId}.pdf`);
}

// --- COMPANY DASHBOARD FUNCTIONS ---
async function setupCompanyDashboard() {
    console.log("Setting up company dashboard...");
    const authSection = document.getElementById('authSection');
    const companyDashboard = document.getElementById('companyDashboard');
    const companyName = document.getElementById('companyName');

    if (authSection) authSection.style.display = 'none';
    if (companyDashboard) companyDashboard.style.display = 'flex';
    if (companyName) companyName.textContent = `Hi, ${userDocData.name}`;

    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    sidebarBtns.forEach(btn => btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
    }));

    showSection('profile');
    loadCompanyProfile();
    setupInternshipManagement();
    loadCompanyApplications();
}

async function loadCompanyProfile() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;

    const data = userDocData.profile || {};
    profileForm.companyNameInput.value = userDocData.name;
    profileForm.companyEmailInput.value = userDocData.email;
    profileForm.companyDescriptionInput.value = data.description || '';
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();
        const data = {
            description: profileForm.companyDescriptionInput.value
        };
        await updateDoc(doc(db, 'users', userId), { profile: data });
        showMessage('Profile updated successfully!');
        hideLoadingOverlay();
    });
}

async function setupInternshipManagement() {
    const addInternshipForm = document.getElementById('addInternshipForm');
    const companyInternshipList = document.getElementById('companyInternshipList');

    if (addInternshipForm) {
        addInternshipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = addInternshipForm.internshipTitle.value;
            const description = addInternshipForm.internshipDescription.value;
            const newInternshipRef = doc(collection(db, 'internships'));
            await setDoc(newInternshipRef, {
                title,
                description,
                companyId: userId,
                createdAt: new Date().toISOString()
            });
            showMessage('Internship added successfully!');
            addInternshipForm.reset();
        });
    }

    if (companyInternshipList) {
        onSnapshot(collection(db, 'internships'), (snapshot) => {
            companyInternshipList.innerHTML = '<h3>Your Internships</h3>';
            snapshot.docs.filter(doc => doc.data().companyId === userId).forEach(doc => {
                const internship = doc.data();
                const div = document.createElement('div');
                div.className = 'list-item';
                div.innerHTML = `
                    <div>
                        <h4>${internship.title}</h4>
                        <p>${internship.description}</p>
                    </div>
                `;
                companyInternshipList.appendChild(div);
            });
        });
    }
}

async function loadCompanyApplications() {
    const pendingApplicationsList = document.getElementById('pendingApplicationsList');
    const approvedApplicationsList = document.getElementById('approvedApplicationsList');
    const currentInternsList = document.getElementById('currentInternsList');
    const completedInternsList = document.getElementById('completedInternsList');

    if (!pendingApplicationsList || !approvedApplicationsList || !currentInternsList || !completedInternsList) return;

    showLoadingOverlay();

    // Attach listener to the current company's document (this read should always be permitted)
    onSnapshot(doc(db, 'users', userId), async (companyDoc) => {
        const companyData = companyDoc.data();
        const applications = companyData.applications_recieved || {};
        const applicationKeys = Object.keys(applications);

        pendingApplicationsList.innerHTML = '';
        approvedApplicationsList.innerHTML = '';
        currentInternsList.innerHTML = '';
        completedInternsList.innerHTML = '';

        if (applicationKeys.length === 0) {
            pendingApplicationsList.innerHTML = '<p>No pending applications.</p>';
            approvedApplicationsList.innerHTML = '<p>No approved interns.</p>';
            currentInternsList.innerHTML = '<p>No current interns.</p>';
            completedInternsList.innerHTML = '<p>No completed interns.</p>';
            hideLoadingOverlay();
            return;
        }

        const promises = applicationKeys.map(async appKey => {
            const appData = applications[appKey];
            if (!appData || !appData.studentId || !appData.internshipId) {
                console.warn(`Corrupt application found (key: ${appKey}). Skipping.`);
                return null;
            }
            
            // FIX: The try/catch block is defensive coding for a permission error originating from the rules.
            // With the corrected rules, this should succeed.
            try {
                const [studentDoc, internshipDoc] = await Promise.all([
                    getDoc(doc(db, 'users', appData.studentId)),
                    getDoc(doc(db, 'internships', appData.internshipId))
                ]);
                
                const student = studentDoc.data();
                const internship = internshipDoc.data();

                if (!student || !internship) {
                    console.warn(`Missing Student or Internship data for application (key: ${appKey}). Skipping.`);
                    return null;
                }
                return { appKey, appData, student, internship };
            } catch (error) {
                console.error(`Permission Error: Could not fetch student/internship details for application ${appKey}. Check security rules.`, error);
                return null; // Skip this application gracefully
            }
        });

        const validApplications = (await Promise.all(promises)).filter(app => app !== null);

        validApplications.forEach(app => {
            const { appKey, appData, student, internship } = app;
            const appCard = document.createElement('div');
            appCard.className = 'list-item card';

            const studentProfileDetails = student.profile ? `
                <hr class="my-2">
                <p><strong>Student Name:</strong> ${student.name}</p>
                <p><strong>Email:</strong> ${student.email}</p>
                <p><strong>Phone:</strong> ${student.profile.phone || 'N/A'}</p>
                <p><strong>D.O.B:</strong> ${student.profile.dob || 'N/A'}</p>
                <p><strong>Address:</strong> ${student.profile.address || 'N/A'}</p>
                <p><strong>12th Stream:</strong> ${student.profile.stream || 'N/A'}</p>
                <p><strong>12th Marks (%):</strong> ${student.profile.marks || 'N/A'}</p>
                <p><strong>Aptitude Score:</strong> ${student.profile.aptitudeScore || 'N/A'}</p>
                <hr class="my-2">
                <p><strong>Bank Name:</strong> ${student.profile.bankName || 'N/A'}</p>
                <p><strong>Account Holder:</strong> ${student.profile.accountHolderName || 'N/A'}</p>
                <p><strong>Account Number:</strong> ${student.profile.accountNumber || 'N/A'}</p>
                <p><strong>Bank Branch:</strong> ${student.profile.bankBranch || 'N/A'}</p>
                <p><strong>IFSC Code:</strong> ${student.profile.ifscCode || 'N/A'}</p>
            ` : 'Student profile is incomplete.';

            appCard.innerHTML = `
                <div>
                    <h4>${student.name} applied for ${internship.title}</h4>
                    <p><strong>Status:</strong> ${appData.status}</p>
                    ${studentProfileDetails}
                </div>
            `;

            if (appData.status === 'Pending Company Approval') {
                const actionDiv = document.createElement('div');
                actionDiv.className = 'flex gap-2';
                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'btn btn-primary btn-sm';
                acceptBtn.textContent = 'Accept';
                acceptBtn.addEventListener('click', async () => {
                    await runTransaction(db, async (transaction) => {
                        const companyRef = doc(db, 'users', userId);
                        const studentRef = doc(db, 'users', appData.studentId);
                        const companyDoc = await transaction.get(companyRef);
                        const studentDoc = await transaction.get(studentRef);

                        if (!companyDoc.exists() || !studentDoc.exists()) throw "Documents do not exist!";

                        const companyApps = companyDoc.data().applications_recieved || {};
                        const studentApps = studentDoc.data().applications || {};

                        companyApps[appKey].status = 'Selected';
                        studentApps[appData.internshipId].status = 'Selected';

                        transaction.update(companyRef, { applications_recieved: companyApps });
                        transaction.update(studentRef, { applications: studentApps });
                    });
                    showMessage('Application accepted! Awaiting student payment.');
                });
                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'btn btn-secondary btn-sm';
                rejectBtn.textContent = 'Reject';
                rejectBtn.addEventListener('click', async () => {
                    const rejectionReason = prompt("Please provide a reason for rejecting this application:");
                    if (rejectionReason) {
                        await runTransaction(db, async (transaction) => {
                            const companyRef = doc(db, 'users', userId);
                            const studentRef = doc(db, 'users', appData.studentId);
                            const companyDoc = await transaction.get(companyRef);
                            const studentDoc = await transaction.get(studentRef);

                            if (!companyDoc.exists() || !studentDoc.exists()) throw "Documents do not exist!";

                            const companyApps = companyDoc.data().applications_recieved || {};
                            const studentApps = studentDoc.data().applications || {};

                            companyApps[appKey].status = 'Rejected';
                            studentApps[appData.internshipId].status = 'Rejected';
                            studentApps[appData.internshipId].rejectionReason = rejectionReason;

                            transaction.update(companyRef, { applications_recieved: companyApps });
                            transaction.update(studentRef, { applications: studentApps });
                        });
                        showMessage('Application rejected!');
                    }
                });
                actionDiv.appendChild(acceptBtn);
                actionDiv.appendChild(rejectBtn);
                appCard.appendChild(actionDiv);
                pendingApplicationsList.appendChild(appCard);
            } else if (appData.status === 'Selected') { // Only selected means awaiting payment
                appCard.innerHTML += `<p class="text-sm text-yellow-500 mt-2">Awaiting student payment...</p>`;
                approvedApplicationsList.appendChild(appCard);
            } else if (appData.status === 'Payment Complete') {
                const issueBtn = document.createElement('button');
                issueBtn.className = 'btn btn-primary';
                issueBtn.textContent = 'Issue Offer Letter';
                issueBtn.addEventListener('click', async () => {
                    await runTransaction(db, async (transaction) => {
                        const companyRef = doc(db, 'users', userId);
                        const studentRef = doc(db, 'users', appData.studentId);
                        const companyDoc = await transaction.get(companyRef);
                        const studentDoc = await transaction.get(studentRef);

                        if (!companyDoc.exists() || !studentDoc.exists()) throw "Documents do not exist!";

                        const companyApps = companyDoc.data().applications_recieved || {};
                        const studentApps = studentDoc.data().applications || {};

                        companyApps[appKey].status = 'Offer Letter Issued';
                        studentApps[appData.internshipId].status = 'Offer Letter Issued';

                        transaction.update(companyRef, { applications_recieved: companyApps });
                        transaction.update(studentRef, { applications: studentApps });
                    });
                    showMessage('Offer Letter issued successfully!');
                });
                appCard.appendChild(issueBtn);
                approvedApplicationsList.appendChild(appCard); // Show in Approved Interns section after payment
            } else if (appData.status === 'Offer Letter Issued' || appData.status === 'Ongoing') {
                 // After offer letter is issued, it moves to current interns until marked completed
                if (appData.status === 'Offer Letter Issued') {
                    appCard.innerHTML += `<p class="text-sm text-yellow-500 mt-2">Offer Letter Issued. Awaiting student acceptance.</p>`;
                }
                
                const completeBtn = document.createElement('button');
                completeBtn.className = 'btn btn-primary';
                completeBtn.textContent = 'Mark as Completed (Issue Certificate)';
                completeBtn.addEventListener('click', async () => {
                    await runTransaction(db, async (transaction) => {
                        const companyRef = doc(db, 'users', userId);
                        const studentRef = doc(db, 'users', appData.studentId);
                        const companyDoc = await transaction.get(companyRef);
                        const studentDoc = await transaction.get(studentRef);

                        if (!companyDoc.exists() || !studentDoc.exists()) throw "Documents do not exist!";

                        const companyApps = companyDoc.data().applications_recieved || {};
                        const studentApps = studentDoc.data().applications || {};

                        companyApps[appKey].status = 'Completed';
                        studentApps[appData.internshipId].status = 'Completed';

                        transaction.update(companyRef, { applications_recieved: companyApps });
                        transaction.update(studentRef, { applications: studentApps });
                    });
                    showMessage('Internship marked as completed! Student can now download certificate.');
                });
                appCard.appendChild(completeBtn);
                currentInternsList.appendChild(appCard);
            } else if (appData.status === 'Completed') {
                completedInternsList.appendChild(appCard);
            }
        });

        if (pendingApplicationsList.innerHTML === '') pendingApplicationsList.innerHTML = '<p>No pending applications.</p>';
        if (approvedApplicationsList.innerHTML === '') approvedApplicationsList.innerHTML = '<p>No approved interns.</p>';
        if (currentInternsList.innerHTML === '') currentInternsList.innerHTML = '<p>No current interns.</p>';
        if (completedInternsList.innerHTML === '') completedInternsList.innerHTML = '<p>No completed interns.</p>';

        hideLoadingOverlay();
    });
}

// --- ADMIN DASHBOARD FUNCTIONS ---
async function setupAdminDashboard() {
    console.log("Setting up admin dashboard...");
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    document.getElementById('adminName').textContent = 'Hi, Admin';

    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    sidebarBtns.forEach(btn => btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
    }));

    showSection('manageStudents');

    loadManageStudents();
    loadManageCompanies();
    loadManageInternships();
    loadManageApplications();
    loadManageAptitudeTest();
    loadManagePayments();
    setupCMS();
}

async function loadManageStudents() {
    const studentList = document.getElementById('studentList');
    if (!studentList) return;

    onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), async (snapshot) => {
        studentList.innerHTML = '';
        snapshot.forEach(doc => {
            const userData = doc.data();
            const studentProfileData = userData.profile || {};
            const div = document.createElement('div');
            div.className = 'list-item card';

            const profileDetails = `
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Phone:</strong> ${studentProfileData.phone || 'N/A'}</p>
                <p><strong>D.O.B:</strong> ${studentProfileData.dob || 'N/A'}</p>
                <p><strong>Address:</strong> ${studentProfileData.address || 'N/A'}</p>
                <p><strong>12th Stream:</strong> ${studentProfileData.stream || 'N/A'}</p>
                <p><strong>12th Marks (%):</strong> ${studentProfileData.marks || 'N/A'}</p>
                <p><strong>Aptitude Score:</strong> ${studentProfileData.aptitudeScore || 'N/A'}</p>
                <hr class="my-2">
                <p><strong>Bank Name:</strong> ${studentProfileData.bankName || 'N/A'}</p>
                <p><strong>Account Holder:</strong> ${studentProfileData.accountHolderName || 'N/A'}</p>
                <p><strong>Account Number:</strong> ${studentProfileData.accountNumber || 'N/A'}</p>
                <p><strong>Bank Branch:</strong> ${studentProfileData.bankBranch || 'N/A'}</p>
                <p><strong>IFSC Code:</strong> ${studentProfileData.ifscCode || 'N/A'}</p>
            `;

            div.innerHTML = `
                <div>
                    <h4>${userData.name}</h4>
                    ${profileDetails}
                </div>
                <div>
                    <button class="btn btn-secondary delete-student" data-id="${doc.id}">Delete</button>
                </div>
            `;
            studentList.appendChild(div);
        });
    });

    studentList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-student')) {
            showLoadingOverlay();
            const userIdToDelete = e.target.dataset.id;
            try {
                await deleteDoc(doc(db, 'users', userIdToDelete));
                showMessage('Student Firestore record deleted successfully! **Remember to delete the user from Firebase Authentication console manually.**', 'success');
            } catch (error) {
                console.error("Error deleting student document:", error);
                showMessage(`Failed to delete user: ${error.message}. Check Firebase Security Rules.`, 'error');
            } finally {
                hideLoadingOverlay();
            }
        }
    });
}

async function loadManageCompanies() {
    const companyList = document.getElementById('companyList');
    if (!companyList) return;

    onSnapshot(query(collection(db, 'users'), where('role', '==', 'company')), (snapshot) => {
        companyList.innerHTML = '';
        snapshot.forEach(doc => {
            const userData = doc.data();
            const companyProfileData = userData.profile || {};
            const div = document.createElement('div');
            div.className = 'list-item card';

            const profileDetails = `
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Description:</strong> ${companyProfileData.description || 'N/A'}</p>
            `;

            div.innerHTML = `
                <div>
                    <h4>${userData.name}</h4>
                    <p><strong>Status:</strong> ${companyProfileData.approved ? 'Approved' : 'Pending'}</p>
                    ${profileDetails}
                </div>
                <div>
                    ${!companyProfileData.approved ? `<button class="btn btn-primary approve-company" data-id="${doc.id}">Approve</button>` : ''}
                    <button class="btn btn-secondary delete-company" data-id="${doc.id}">Delete</button>
                </div>
            `;
            companyList.appendChild(div);
        });
    });

    companyList.addEventListener('click', async (e) => {
        showLoadingOverlay();
        const target = e.target;
        const companyId = target.dataset.id;
        
        if (target.classList.contains('approve-company')) {
            try {
                await updateDoc(doc(db, 'users', companyId), { 'profile.approved': true });
                showMessage('Company approved successfully!');
            } catch (error) {
                console.error("Error approving company:", error);
                showMessage(`Failed to approve company: ${error.message}.`, 'error');
            }
        } else if (target.classList.contains('delete-company')) {
             try {
                // In a real application, deleting a company requires cleaning up ALL associated data:
                // 1. Delete company document.
                // 2. Delete all related internships (from 'internships' collection).
                // 3. Clean up all related student applications.
                
                // For simplicity, we only delete the user document and rely on cascade logic (not implemented here) or manual cleanup.
                await deleteDoc(doc(db, 'users', companyId));
                showMessage('Company Firestore record deleted successfully! **Remember to delete the user from Firebase Authentication console and clean up related data (internships, applications) manually.**', 'success');
            } catch (error) {
                console.error("Error deleting company document:", error);
                showMessage(`Failed to delete company: ${error.message}. Check Firebase Security Rules.`, 'error');
            }
        }
        hideLoadingOverlay();
    });
}

async function loadManageInternships() {
    const internshipList = document.getElementById('internshipList');
    const companySelect = document.getElementById('adminInternshipCompany');
    const addInternshipForm = document.getElementById('addInternshipForm');

    if (!internshipList || !companySelect || !addInternshipForm) return;

    // 1. Populate Company Select Dropdown
    const companiesSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'company')));
    companySelect.innerHTML = '';
    companiesSnapshot.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.data().name;
        companySelect.appendChild(option);
    });

    // 2. Add New Internship Handler
    addInternshipForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();
        const title = addInternshipForm.adminInternshipTitle.value;
        const description = addInternshipForm.adminInternshipDescription.value;
        const companyId = addInternshipForm.adminInternshipCompany.value;

        try {
             const newInternshipRef = doc(collection(db, 'internships'));
             await setDoc(newInternshipRef, {
                 title,
                 description,
                 companyId: companyId,
                 createdAt: new Date().toISOString()
             });
             showMessage('Internship added successfully!');
             addInternshipForm.reset();
        } catch (error) {
            console.error("Error adding internship:", error);
            showMessage('Failed to add internship.', 'error');
        } finally {
            hideLoadingOverlay();
        }
    });

    // 3. Load and Manage Internship List (with delete button)
    onSnapshot(collection(db, 'internships'), async (snapshot) => {
        internshipList.innerHTML = '';
        const companiesData = (await getDocs(query(collection(db, 'users'), where('role', '==', 'company')))).docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data().name }), {});

        snapshot.forEach(doc => {
            const internship = doc.data();
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div>
                    <h4>${internship.title}</h4>
                    <p><strong>Company:</strong> ${companiesData[internship.companyId] || 'Unknown Company'}</p>
                    <p>${internship.description}</p>
                </div>
                <button class="btn btn-secondary delete-internship" data-id="${doc.id}">Delete</button>
            `;
            internshipList.appendChild(div);
        });
    });
    
    // 4. Delete Internship Handler
    internshipList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-internship')) {
            showLoadingOverlay();
            const internshipIdToDelete = e.target.dataset.id;
            try {
                await deleteDoc(doc(db, 'internships', internshipIdToDelete));
                showMessage('Internship deleted successfully!');
            } catch (error) {
                console.error("Error deleting internship document:", error);
                showMessage(`Failed to delete internship: ${error.message}.`, 'error');
            } finally {
                hideLoadingOverlay();
            }
        }
    });
}

async function loadManageApplications() {
    const applicationsList = document.getElementById('applicationsList');
    const statusFilter = document.getElementById('statusFilter');

    if (!applicationsList || !statusFilter) return;

    // FIX 1: Update the filter options to remove the deprecated status
    statusFilter.innerHTML = `
        <option value="All">All</option>
        <option value="Pending Admin Approval">Pending Admin Approval</option>
        <option value="Pending Company Approval">Pending Company Approval</option>
        <option value="Selected">Selected</option>
        <option value="Payment Complete">Payment Complete</option>
        <option value="Offer Letter Issued">Offer Letter Issued</option>
        <option value="Ongoing">Ongoing</option>
        <option value="Completed">Completed</option>
        <option value="Rejected">Rejected</option>
    `;

    const renderApplications = async (filterStatus) => {
        applicationsList.innerHTML = '';
        const allUsers = (await getDocs(collection(db, 'users'))).docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});
        const internshipDocs = await getDocs(collection(db, 'internships'));
        const internships = internshipDocs.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});

        let applicationsFound = false;
        const allApplications = {};

        for (const userId in allUsers) {
            const userData = allUsers[userId];
            if (userData.role === 'student' && userData.applications) {
                for (const internshipId in userData.applications) {
                    const appData = userData.applications[internshipId];
                    const appKey = `${internshipId}_${userId}`;
                    allApplications[appKey] = { ...appData, studentId: userId, internshipId: internshipId, companyId: appData.companyId, uid: userId };
                }
            }
        }

        for (const appKey in allApplications) {
            const appData = allApplications[appKey];
            
            // Filter by status if specified
            if (filterStatus !== 'All' && appData.status !== filterStatus) {
                continue;
            }

            const student = allUsers[appData.studentId];
            const company = allUsers[appData.companyId];
            const internship = internships[appData.internshipId];

            if (student && company && internship) {
                applicationsFound = true;
                const div = document.createElement('div');
                div.className = 'list-item card';

                let actionButtons = '';
                if (appData.status === 'Applied') {
                    actionButtons = `
                        <button class="btn btn-primary approve-app-btn" data-key="${appKey}" data-studentid="${appData.studentId}" data-companyid="${appData.companyId}" data-internshipid="${appData.internshipId}">Approve</button>
                        <button class="btn btn-secondary reject-app-btn" data-key="${appKey}" data-studentid="${appData.studentId}" data-internshipid="${appData.internshipId}">Reject</button>
                    `;
                }


                div.innerHTML = `
                    <div>
                        <h4>${student.name} applied to ${internship.title}</h4>
                        <p><strong>Company:</strong> ${company.name}</p>
                        <p><strong>Status:</strong> ${appData.status}</p>
                        ${appData.rejectionReason ? `<p><strong>Rejection Reason:</strong> ${appData.rejectionReason}</p>` : ''}
                        ${['Offer Letter Issued', 'Ongoing', 'Completed', 'Payment Complete'].includes(appData.status) ? `<p><strong>Offer Letter:</strong> <a href="#" class="download-doc" data-type="offerLetter" data-studentid="${appData.studentId}" data-companyid="${appData.companyId}" data-internshipid="${appData.internshipId}">Download</a></p>` : ''}
                        ${appData.status === 'Completed' ? `<p><strong>Certificate:</strong> <a href="#" class="download-doc" data-type="certificate" data-studentid="${appData.studentId}" data-companyid="${appData.companyId}" data-internshipid="${appData.internshipId}">Download</a></p>` : ''}
                        ${appData.paymentId ? `<p><strong>Payment Receipt:</strong> <a href="#" class="download-doc" data-type="paymentReceipt" data-studentid="${appData.studentId}" data-companyid="${appData.companyId}" data-internshipid="${appData.internshipId}">Download</a></p>` : ''}
                    </div>
                    <div class="flex gap-2">
                        ${actionButtons}
                    </div>
                `;
                applicationsList.appendChild(div);
            }
        }

        if (!applicationsFound) {
            applicationsList.innerHTML = `<p>No applications found for status: ${filterStatus}.</p>`;
        }
    };

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            renderApplications(statusFilter.value);
        });
    }

    onSnapshot(collection(db, 'users'), () => {
        renderApplications(statusFilter.value);
    });

    applicationsList.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('approve-app-btn')) {
            showLoadingOverlay();
            const appKey = target.dataset.key;
            const studentId = target.dataset.studentid;
            const companyId = target.dataset.companyid;
            const internshipId = target.dataset.internshipid;

            if (!studentId || !companyId || !internshipId) {
                showMessage('Error: Missing data for approval.', 'error');
                hideLoadingOverlay();
                return;
            }

            try {
                await runTransaction(db, async (transaction) => {
                    const studentRef = doc(db, 'users', studentId);
                    const companyRef = doc(db, 'users', companyId);
                    const adminRef = doc(db, 'users', ADMIN_UID);

                    const studentDoc = await transaction.get(studentRef);
                    const companyDoc = await transaction.get(companyRef);
                    const adminDoc = await transaction.get(adminRef);

                    if (!studentDoc.exists() || !companyDoc.exists() || !adminDoc.exists()) throw "Documents do not exist!";

                    const studentApplications = studentDoc.data().applications;
                    const companyReceived = companyDoc.data().applications_recieved || {};

                    studentApplications[internshipId].status = 'Pending Company Approval';
                    
                    // FIX: Ensure companyReceived object exists before accessing its property,
                    // and also ensure the record exists, if not, create it based on student application data.
                    const studentAppData = studentApplications[internshipId];
                    
                    if (!companyReceived[`${internshipId}_${studentId}`]) {
                         // The record is missing, initialize it from the student's application data
                         companyReceived[`${internshipId}_${studentId}`] = {
                            studentId,
                            internshipId,
                            status: 'Pending Company Approval',
                            appliedAt: studentAppData.appliedAt
                        };
                    } else {
                         // The record exists, just update the status
                         companyReceived[`${internshipId}_${studentId}`].status = 'Pending Company Approval';
                    }

                    transaction.update(studentRef, { applications: studentApplications });
                    transaction.update(companyRef, { applications_recieved: companyReceived });
                    transaction.update(adminRef, { [`pending_applications.${appKey}`]: deleteField() });
                });
                showMessage('Application approved by admin and sent to company for review.');
            } catch (error) {
                console.error("Transaction failed:", error);
                showMessage('Transaction failed.', 'error');
            } finally {
                hideLoadingOverlay();
            }
        }

        if (target.classList.contains('reject-app-btn')) {
            showLoadingOverlay();
            const appKey = target.dataset.key;
            const studentId = target.dataset.studentid;
            const internshipId = target.dataset.internshipid;

            const rejectionReason = prompt("Please enter the reason for rejecting this application:");
            if (!rejectionReason) {
                hideLoadingOverlay();
                return;
            }

            try {
                await runTransaction(db, async (transaction) => {
                    const studentRef = doc(db, 'users', studentId);
                    const adminRef = doc(db, 'users', ADMIN_UID);
                    const studentDoc = await transaction.get(studentRef);
                    const adminDoc = await transaction.get(adminRef);

                    if (!studentDoc.exists() || !adminDoc.exists()) throw "Documents do not exist!";

                    const studentApplications = studentDoc.data().applications;
                    studentApplications[internshipId].status = 'Rejected';
                    studentApplications[internshipId].rejectionReason = rejectionReason;

                    transaction.update(studentRef, { applications: studentApplications });
                    transaction.update(adminRef, { [`pending_applications.${appKey}`]: deleteField() });
                });
                showMessage('Application rejected by admin.');
            } catch (error) {
                console.error("Transaction failed:", error);
                showMessage('Transaction failed.', 'error');
            } finally {
                hideLoadingOverlay();
            }
        }

        // REMOVED: Payment approval logic is removed from Admin Application management
        // The payments are now auto-approved on the student side.

        if (target.classList.contains('download-doc')) {
            e.preventDefault();
            showLoadingOverlay();
            const docType = e.target.dataset.type;
            const studentId = e.target.dataset.studentid;
            const companyId = e.target.dataset.companyid;
            const internshipId = e.target.dataset.internshipid;

            try {
                const studentDoc = await getDoc(doc(db, 'users', studentId));
                const companyDoc = await getDoc(doc(db, 'users', companyId));
                const internshipDoc = await getDoc(doc(db, 'internships', internshipId));

                if (!studentDoc.exists() || !companyDoc.exists() || !internshipDoc.exists()) {
                    throw new Error("Missing data for PDF generation.");
                }

                // Get the application data specific to this internship/student
                const appData = studentDoc.data().applications[internshipId];

                if (docType === 'offerLetter') {
                    // Pass the specific appData object
                    await generateOfferLetterPDF(studentDoc.data(), internshipDoc.data(), companyDoc.data(), appData);
                } else if (docType === 'certificate') {
                    await generateCertificatePDF(studentDoc.data(), internshipDoc.data(), companyDoc.data());
                } else if (docType === 'paymentReceipt') {
                    // const studentApps = studentDoc.data().applications || {};
                    // const appData = studentApps[internshipId];
                    if (!appData || !appData.paymentId) {
                        throw new Error("Missing payment ID for receipt generation.");
                    }
                    await generatePaymentReceiptPDF(studentDoc.data(), internshipDoc.data(), companyDoc.data(), appData.paymentId);
                }
                showMessage('Document downloaded successfully!', 'success');
            } catch (error) {
                console.error("Failed to download document:", error);
                showMessage('Failed to download document.', 'error');
            } finally {
                hideLoadingOverlay();
            }
        }
    });
}

async function loadManageAptitudeTest() {
    const questionsList = document.getElementById('questionsList');
    const addQuestionForm = document.getElementById('addQuestionForm');
    if (!questionsList || !addQuestionForm) return;

    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay();
        const data = {
            question: addQuestionForm.questionText.value,
            optionA: addQuestionForm.optionA.value,
            optionB: addQuestionForm.optionB.value,
            optionC: addQuestionForm.optionC.value,
            correctOption: addQuestionForm.correctOption.value.toUpperCase()
        };
        const adminDocRef = doc(db, 'users', ADMIN_UID);
        await updateDoc(adminDocRef, {
            [`questions.${Date.now().toString()}`]: data
        });
        showMessage('Question added successfully!');
        addQuestionForm.reset();
        hideLoadingOverlay();
    });

    onSnapshot(doc(db, 'users', ADMIN_UID), (doc) => {
        if (!questionsList) return;
        const questions = doc.data().questions || {};
        questionsList.innerHTML = '';
        for (const qKey in questions) {
            const q = questions[qKey];
            const div = document.createElement('div');
            div.className = 'list-item card';
            div.innerHTML = `
                <div>
                    <h4>Q: ${q.question}</h4>
                    <p><strong>A:</strong> ${q.optionA}</p>
                    <p><strong>B:</strong> ${q.optionB}</p>
                    <p><strong>C:</strong> ${q.optionC}</p>
                    <p><strong>Correct:</strong> ${q.correctOption}</p>
                </div>
                <button class="btn btn-secondary delete-question" data-key="${qKey}">Delete</button>
            `;
            questionsList.appendChild(div);
        }
    });

    questionsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-question')) {
            showLoadingOverlay();
            const qKey = e.target.dataset.key;
            await updateDoc(doc(db, 'users', ADMIN_UID), {
                [`questions.${qKey}`]: deleteField()
            });
            showMessage('Question deleted!');
            hideLoadingOverlay();
        }
    });
}

async function loadManagePayments() {
    const paymentsList = document.getElementById('paymentsList');
    const statusFilter = document.getElementById('statusFilter');
    if (!paymentsList || !statusFilter) return;

    // Adjust status filter options for automatic payment
    statusFilter.innerHTML = `
        <option value="All">All</option>
        <option value="Complete">Complete</option>
        <!-- Removed Payment Pending Admin Approval -->
    `;
    
    // Set default filter to 'Complete'
    statusFilter.value = 'Complete';


    const renderPayments = async (filterStatus) => {
        paymentsList.innerHTML = '';
        const allUsers = (await getDocs(collection(db, 'users'))).docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});
        const internshipDocs = await getDocs(collection(db, 'internships'));
        const internships = internshipDocs.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {});

        let paymentFound = false;
        const allApplications = {};
        const allPayments = allUsers[ADMIN_UID]?.payments || {}; // Get payments from Admin doc

        // FIX 2: Iterate over the Admin's payment records instead of iterating over student applications, 
        // because the Admin payment object holds the actual 'Complete' status record.

        for (const appKey in allPayments) {
            const paymentRecord = allPayments[appKey];
            
            let paymentRecordStatus = paymentRecord.status;

            // Only filter for Complete if specifically requested, or All
            if (filterStatus === 'All' || paymentRecordStatus === filterStatus) {
                const student = allUsers[paymentRecord.studentId];
                const internship = internships[paymentRecord.internshipId];
                const company = allUsers[paymentRecord.companyId];

                if (student && company && internship) {
                    paymentFound = true;
                    const div = document.createElement('div');
                    div.className = 'list-item card';
                    div.innerHTML = `
                        <div>
                            <h4>Payment by ${student.name}</h4>
                            <p><strong>Amount:</strong> ₹${paymentRecord.amount}</p>
                            <p><strong>Internship:</strong> ${internship.title}</p>
                            <p><strong>Company:</strong> ${company.name}</p>
                            <p><strong>Status:</strong> ${paymentRecordStatus}</p>
                            <p><strong>Date:</strong> ${new Date(paymentRecord.date).toLocaleDateString()}</p>
                            ${paymentRecord.paymentId ? `<p><strong>Receipt ID:</strong> ${paymentRecord.paymentId}</p>` : ''}
                        </div>
                    `;
                    
                    paymentsList.appendChild(div);
                }
            }
        }

        if (!paymentFound) {
            paymentsList.innerHTML = `<p>No payments found for the selected filter.</p>`;
        }
    };

    statusFilter.addEventListener('change', () => {
        // Only render if selection is valid (i.e., not a removed option like "Pending Admin Approval")
        if (statusFilter.value === 'Complete' || statusFilter.value === 'All') {
            renderPayments(statusFilter.value);
        }
    });

    // Initial render and listen to changes in users to update payment status immediately
    onSnapshot(collection(db, 'users'), () => {
        renderPayments(statusFilter.value);
    });

    // REMOVED: The 'paymentsList' click listener for 'approve-payment-btn' is removed.
}

async function setupCMS() {
    const cmsForm = document.getElementById('cmsForm');
    const heroTitleInput = document.getElementById('heroTitle');
    const heroDescriptionInput = document.getElementById('heroDescription');
    const contactMessagesList = document.getElementById('contactMessagesList');
    const faqList = document.getElementById('faqList');
    const addFaqForm = document.getElementById('addFaqForm');
    const faqQuestionInput = document.getElementById('faqQuestion');
    const faqAnswerInput = document.getElementById('faqAnswer');

    const adminDocRef = doc(db, 'users', ADMIN_UID);

    if (cmsForm) {
        // Listen to Admin document for CMS data and FAQS
        onSnapshot(doc(db, 'users', ADMIN_UID), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const cmsData = data.cms || {};
                if (heroTitleInput) heroTitleInput.value = cmsData.heroTitle || '';
                if (heroDescriptionInput) heroDescriptionInput.value = cmsData.heroDescription || '';

                const faqs = data.faqs || {};
                if (faqList) {
                    faqList.innerHTML = '';
                    for (const key in faqs) {
                        const faq = faqs[key];
                        const div = document.createElement('div');
                        div.className = 'list-item card';
                        div.innerHTML = `
                            <div>
                                <h4>Q: ${faq.question}</h4>
                                <p>A: ${faq.answer}</p>
                            </div>
                            <div>
                                <button class="btn btn-secondary delete-faq" data-key="${key}">Delete</button>
                            </div>
                        `;
                        faqList.appendChild(div);
                    }
                }
                
                // Load Contact Messages (now embedded in the Admin document)
                const messages = data.contactMessages || {};
                if (contactMessagesList) {
                     contactMessagesList.innerHTML = '';
                     for(const key in messages) {
                        const message = messages[key];
                        const div = document.createElement('div');
                        div.className = 'list-item card';
                        div.innerHTML = `
                            <div>
                                <h4>From: ${message.name} (${message.email})</h4>
                                <p>${message.message}</p>
                                <p class="text-sm text-gray-500">Sent on: ${new Date(message.timestamp).toLocaleString()}</p>
                            </div>
                        `;
                        contactMessagesList.appendChild(div);
                     }
                }
            }
        });

        cmsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoadingOverlay();
            const cmsContent = {
                heroTitle: heroTitleInput.value,
                heroDescription: heroDescriptionInput.value,
            };
            await updateDoc(adminDocRef, { 'cms': cmsContent });
            showMessage('Homepage content updated successfully!');
            hideLoadingOverlay();
        });
    }

    if (addFaqForm) {
        addFaqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoadingOverlay();
            const faqData = {
                question: faqQuestionInput.value,
                answer: faqAnswerInput.value
            };
            const faqId = Date.now().toString();
            await updateDoc(adminDocRef, {
                [`faqs.${faqId}`]: faqData
            });
            showMessage('FAQ added successfully!');
            addFaqForm.reset();
            hideLoadingOverlay();
        });
    }

    if (faqList) {
        faqList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-faq')) {
                showLoadingOverlay();
                const faqKey = e.target.dataset.key;
                await updateDoc(doc(db, 'users', ADMIN_UID), {
                    [`faqs.${faqKey}`]: deleteField()
                });
                showMessage('FAQ deleted successfully!');
                hideLoadingOverlay();
            }
        });
    }
}

// Initial calls based on page
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('index.html')) {
        loadLandingPageData();
    }
});


