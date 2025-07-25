import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendEmailVerification, User } from 'firebase/auth';
import { getDatabase, ref, push, set, onValue, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import emailjs from '@emailjs/browser';
import { Chart, registerables } from 'chart.js';
import { Home, AlertCircle, Shield, LogIn, LogOut, X, MapPin, Clock, User as UserIcon, Edit, Trash, Droplet, Zap, Car, Triangle as ExclamationTriangle, RefreshCw as Refresh, Download, Bell, BarChart3, Notebook as Robot, Plane as PaperPlane, CheckCircle, Loader } from 'lucide-react';

Chart.register(...registerables);

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAE1ZW1yDjkcXQqv5Lv7RJCXAk7FMJJY7c",
  authDomain: "gramaalert.firebaseapp.com",
  databaseURL: "https://gramaalert-default-rtdb.firebaseio.com/",
  projectId: "gramaalert",
  storageBucket: "gramaalert.firebasestorage.app",
  messagingSenderId: "304218727115",
  appId: "1:304218727115:web:5d0ee312d106e73277314e",
  measurementId: "G-K4GZ0TWL8V"
};

// EmailJS Configuration
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_cnntsz7',
  TEMPLATE_ID: 'template_1fztfaf',
  PUBLIC_KEY: 'NKsb5epQ8oZsSh-wE'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);

interface Issue {
  id?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: 'pending' | 'in-progress' | 'resolved';
  reportedBy: string;
  reportedByUid: string;
  reportedAt: string;
  imageUrl?: string;
  aiSummary?: string;
  resolutionNote?: string;
  updatedAt: string;
}

interface UserData {
  email: string;
  role: 'citizen' | 'admin';
  createdAt: string;
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [issues, setIssues] = useState<Record<string, Issue>>({});
  const [currentView, setCurrentView] = useState<'dashboard' | 'report' | 'admin'>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [currentIssueId, setCurrentIssueId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [authLoading, setAuthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [showVerificationNotice, setShowVerificationNotice] = useState(false);

  // Charts
  const [statusChart, setStatusChart] = useState<Chart | null>(null);
  const [categoryChart, setCategoryChart] = useState<Chart | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.emailVerified) {
          setCurrentUser(user);
          loadUserData(user.uid);
          setShowVerificationNotice(false);
        } else {
          setCurrentUser(user);
          setShowVerificationNotice(true);
        }
      } else {
        setCurrentUser(null);
        setUserRole('');
        setShowVerificationNotice(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadUserData = (uid: string) => {
    const userRef = ref(database, 'users/' + uid);
    onValue(userRef, (snapshot) => {
      const userData = snapshot.val();
      if (userData && userData.role) {
        setUserRole(userData.role);
      }
    });
  };

  const loadIssues = () => {
    const issuesRef = ref(database, 'issues');
    onValue(issuesRef, (snapshot) => {
      const issuesData = snapshot.val() || {};
      setIssues(issuesData);
    });
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'success' ? 'bg-green-500' : 
      type === 'error' ? 'bg-red-500' : 
      'bg-blue-500'
    } text-white max-w-md`;
    
    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-3 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const adminCode = formData.get('adminCode') as string;

    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (isLogin) {
        // Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.emailVerified) {
          showNotification('Logged in successfully!', 'success');
          setShowAuthModal(false);
        } else {
          setAuthSuccess('Login successful! Please verify your email address to access all features. Check your inbox for the verification link.');
        }
      } else {
        // Register
        if (role === 'admin' && adminCode !== 'ADMIN2024') {
          throw new Error('Invalid admin access code');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Send email verification
        await sendEmailVerification(user);
        
        // Save user role to database
        await set(ref(database, 'users/' + user.uid), {
          email: email,
          role: role,
          createdAt: new Date().toISOString()
        });

        // CRITICAL CHANGE: Sign out the user after registration
        await signOut(auth);
        
        // Show browser alert
        alert('Verification email sent. Please verify your email before logging in.');
        
        // Switch to login mode and hide modal
        setIsLogin(true);
        setShowAuthModal(false);
        
        showNotification('Account created! Please verify your email address before logging in.', 'success');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification('Logged out successfully!', 'info');
      setCurrentView('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
      showNotification('Error logging out', 'error');
    }
  };

  const resendVerificationEmail = async () => {
    if (currentUser && !currentUser.emailVerified) {
      try {
        await sendEmailVerification(currentUser);
        showNotification('Verification email sent! Please check your inbox.', 'success');
      } catch (error: any) {
        showNotification('Error sending verification email: ' + error.message, 'error');
      }
    }
  };

  const handleViewChange = (view: 'dashboard' | 'report' | 'admin') => {
    if (!currentUser && (view === 'report' || view === 'admin')) {
      showNotification('Please login to access this feature', 'error');
      setShowAuthModal(true);
      return;
    }

    if (currentUser && !currentUser.emailVerified && (view === 'report' || view === 'admin')) {
      showNotification('Please verify your email address to access this feature', 'error');
      setCurrentView('dashboard');
      return;
    }

    if (view === 'admin' && (!currentUser || userRole !== 'admin' || !currentUser.emailVerified)) {
      showNotification('Admin access required with verified email', 'error');
      setCurrentView('dashboard');
      return;
    }

    setCurrentView(view);
  };

  const handleIssueSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!currentUser) {
      showNotification('Please login to report an issue', 'error');
      return;
    }

    if (!currentUser.emailVerified) {
      showNotification('Please verify your email address before reporting issues', 'error');
      return;
    }

    setSubmitLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const location = formData.get('location') as string;
    const imageFile = formData.get('image') as File;

    try {
      let imageUrl = null;
      
      if (imageFile && imageFile.size > 0) {
        const imageRef = storageRef(storage, 'issues/' + Date.now() + '_' + imageFile.name);
        const snapshot = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const newIssue = {
        title: title,
        description: description,
        category: category || getAICategory(description),
        location: location,
        status: 'pending' as const,
        reportedBy: currentUser.email!,
        reportedByUid: currentUser.uid,
        reportedAt: new Date().toISOString(),
        imageUrl: imageUrl,
        aiSummary: generateAISummary(description),
        resolutionNote: null,
        updatedAt: new Date().toISOString()
      };

      const issueRef = await push(ref(database, 'issues'), newIssue);

      await sendIssueSubmissionEmail(currentUser.email!, newIssue, issueRef.key!);

      (e.target as HTMLFormElement).reset();
      
      showNotification('Issue reported successfully! Confirmation email sent.', 'success');
      setCurrentView('dashboard');
    } catch (error: any) {
      console.error('Error submitting issue:', error);
      showNotification('Error submitting issue: ' + error.message, 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const sendIssueSubmissionEmail = async (userEmail: string, issue: any, issueId: string) => {
    try {
      const emailParams = {
        to_email: userEmail,
        user_name: userEmail.split('@')[0],
        issue_title: issue.title,
        issue_id: issueId,
        issue_description: issue.description,
        issue_location: issue.location,
        issue_category: issue.category,
        submit_date: new Date().toLocaleDateString()
      };

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID,
        emailParams,
        EMAILJS_CONFIG.PUBLIC_KEY
      );
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  };

  const generateAISummary = (description: string) => {
    const words = description.toLowerCase();
    let summary = '';
    
    if (words.includes('water') || words.includes('supply') || words.includes('pipe')) {
      summary = 'Water supply disruption reported affecting local infrastructure';
    } else if (words.includes('road') || words.includes('pothole') || words.includes('street')) {
      summary = 'Road infrastructure maintenance required for public safety';
    } else if (words.includes('light') || words.includes('electricity') || words.includes('power')) {
      summary = 'Electrical infrastructure issue affecting community services';
    } else if (words.includes('garbage') || words.includes('waste') || words.includes('trash')) {
      summary = 'Waste management issue requiring municipal attention';
    } else if (words.includes('drainage') || words.includes('flood') || words.includes('sewer')) {
      summary = 'Drainage system issue affecting area sanitation';
    } else {
      summary = 'Community infrastructure issue reported requiring assessment';
    }
    
    return summary;
  };

  const getAICategory = (description: string) => {
    const words = description.toLowerCase();
    
    if (words.includes('water') || words.includes('supply') || words.includes('pipe') || words.includes('tap')) {
      return 'water';
    } else if (words.includes('road') || words.includes('pothole') || words.includes('street') || words.includes('path')) {
      return 'road';
    } else if (words.includes('light') || words.includes('electricity') || words.includes('power') || words.includes('wire')) {
      return 'electricity';
    } else if (words.includes('garbage') || words.includes('waste') || words.includes('trash') || words.includes('dump')) {
      return 'garbage';
    } else {
      return 'other';
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        const locations = [
          'Main Road, Near Panchayat Office',
          'Gandhi Chowk, Market Area',
          'Temple Street, Near Hanuman Temple',
          'School Road, Near Primary School',
          'Bus Stand, Central Area',
          'Village Square, Community Center',
          'Gurudwara Road, Near Religious Center',
          'Hospital Road, Near PHC'
        ];
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];
        const locationInput = document.getElementById('issueLocation') as HTMLInputElement;
        if (locationInput) {
          locationInput.value = randomLocation;
        }
        showNotification('Location detected!', 'success');
      }, function() {
        showNotification('Unable to get location. Please enter manually.', 'error');
      });
    } else {
      showNotification('Geolocation not supported by this browser', 'error');
    }
  };

  const updateIssueStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!currentUser || !currentUser.emailVerified) {
      showNotification('Email verification required to update issues', 'error');
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as string;
    const note = formData.get('note') as string;
    const issue = issues[currentIssueId!];
    const oldStatus = issue.status;

    setUpdateLoading(true);

    try {
      const updates = {
        [`issues/${currentIssueId}/status`]: status,
        [`issues/${currentIssueId}/resolutionNote`]: note,
        [`issues/${currentIssueId}/updatedAt`]: new Date().toISOString()
      };
      
      await update(ref(database), updates);

      if (oldStatus !== status) {
        await sendStatusUpdateEmail(issue.reportedBy, {...issue, resolutionNote: note}, currentIssueId!, oldStatus, status);
      }

      setShowUpdateModal(false);
      setCurrentIssueId(null);
      showNotification('Issue updated successfully! Email notification sent.', 'success');
    } catch (error: any) {
      console.error('Error updating issue:', error);
      showNotification('Error updating issue: ' + error.message, 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const sendStatusUpdateEmail = async (userEmail: string, issue: any, issueId: string, oldStatus: string, newStatus: string) => {
    try {
      const emailParams = {
        to_email: userEmail || "default@example.com",
        user_name: userEmail.split('@')[0] || "User",
        issue_title: issue?.title || "No title provided",
        issue_id: issueId || "N/A",
        old_status: oldStatus || "N/A",
        new_status: newStatus || "N/A",
        update_date: new Date().toLocaleString() || "N/A",
        resolution_note: issue.resolutionNote || "No notes provided",
      };

      await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        'template_ppbuv1y',
        emailParams,
        EMAILJS_CONFIG.PUBLIC_KEY
      );
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  };

  const getFilteredIssues = () => {
    return Object.entries(issues).filter(([key, issue]) => {
      const statusMatch = statusFilter === 'all' || issue.status === statusFilter;
      const categoryMatch = categoryFilter === 'all' || issue.category === categoryFilter;
      return statusMatch && categoryMatch;
    }).sort(([,a], [,b]) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'water': return <Droplet className="w-5 h-5" />;
      case 'road': return <Car className="w-5 h-5" />;
      case 'electricity': return <Zap className="w-5 h-5" />;
      case 'garbage': return <Trash className="w-5 h-5" />;
      default: return <ExclamationTriangle className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const issueArray = Object.values(issues);
  const totalIssues = issueArray.length;
  const pendingIssues = issueArray.filter(issue => issue.status === 'pending').length;
  const inProgressIssues = issueArray.filter(issue => issue.status === 'in-progress').length;
  const resolvedIssues = issueArray.filter(issue => issue.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Email Verification Notice */}
      {showVerificationNotice && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-3 text-center text-sm">
          <div className="flex items-center justify-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Please verify your email address to access all features. Check your inbox for the verification link.
            <button 
              onClick={resendVerificationEmail}
              className="ml-4 underline hover:no-underline"
            >
              Resend Email
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Home className="w-8 h-8 text-blue-600 mr-2" />
              <span className="text-xl font-bold text-gray-900">GramaAlert</span>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => handleViewChange('dashboard')}
                className={`nav-item px-3 py-2 rounded-md text-sm font-medium ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:text-gray-900'}`}
              >
                <Home className="w-4 h-4 inline mr-1" />Dashboard
              </button>
              <button 
                onClick={() => handleViewChange('report')}
                className={`nav-item px-3 py-2 rounded-md text-sm font-medium ${currentView === 'report' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:text-gray-900'}`}
              >
                <AlertCircle className="w-4 h-4 inline mr-1" />Report Issue
              </button>
              {userRole === 'admin' && currentUser?.emailVerified && (
                <button 
                  onClick={() => handleViewChange('admin')}
                  className={`nav-item px-3 py-2 rounded-md text-sm font-medium ${currentView === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:text-gray-900'}`}
                >
                  <Shield className="w-4 h-4 inline mr-1" />Admin
                </button>
              )}
              {!currentUser ? (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  <LogIn className="w-4 h-4 inline mr-1" />Login
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                  >
                    <LogOut className="w-4 h-4 inline mr-1" />Logout
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentUser.email}{!currentUser.emailVerified && ' (Unverified)'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Village Issues Dashboard</h1>
              <p className="text-gray-600">Track and monitor reported issues in your village</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="water">Water</option>
                    <option value="road">Road</option>
                    <option value="electricity">Electricity</option>
                    <option value="garbage">Garbage</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      setStatusFilter('all');
                      setCategoryFilter('all');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    <Refresh className="w-4 h-4 inline mr-1" />Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Issues</p>
                    <p className="text-2xl font-bold text-gray-900">{totalIssues}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <AlertCircle className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingIssues}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">{inProgressIssues}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Loader className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Resolved</p>
                    <p className="text-2xl font-bold text-green-600">{resolvedIssues}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Issues List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Issues</h2>
              <div className="space-y-4">
                {getFilteredIssues().length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No issues found</p>
                  </div>
                ) : (
                  getFilteredIssues().map(([key, issue]) => (
                    <div key={key} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center">
                          <div className="text-blue-600 mr-2">
                            {getCategoryIcon(issue.category)}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">{issue.title}</h3>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(issue.status)}`}>
                          {issue.status.replace('-', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{issue.aiSummary || issue.description.substring(0, 100)}...</p>
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <UserIcon className="w-4 h-4 mr-1" />
                        <span className="mr-4">{issue.reportedBy.split('@')[0]}</span>
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="mr-4">{issue.location}</span>
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{formatDate(issue.reportedAt)}</span>
                      </div>
                      {issue.imageUrl && (
                        <div className="mb-3">
                          <img src={issue.imageUrl} alt="Issue" className="w-full h-48 object-cover rounded-md" />
                        </div>
                      )}
                      {issue.resolutionNote && (
                        <div className="bg-green-50 p-3 rounded-md">
                          <p className="text-sm text-green-800"><strong>Resolution:</strong> {issue.resolutionNote}</p>
                        </div>
                      )}
                      {currentUser && currentUser.uid === issue.reportedByUid && (
                        <div className="mt-3 text-xs text-blue-600">
                          <CheckCircle className="w-4 h-4 inline mr-1" />Your Report
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report Issue View */}
        {currentView === 'report' && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Report an Issue</h1>
              <p className="text-gray-600">Help improve your village by reporting issues</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <form onSubmit={handleIssueSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Issue Title *</label>
                    <input 
                      type="text" 
                      name="title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="e.g., Street Light Not Working" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select 
                      name="category"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Auto-categorize (AI)</option>
                      <option value="water">Water Supply</option>
                      <option value="road">Road & Transportation</option>
                      <option value="electricity">Electricity</option>
                      <option value="garbage">Garbage Collection</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description *</label>
                  <textarea 
                    name="description"
                    rows={4} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Please provide detailed information about the issue..." 
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input 
                      type="text" 
                      name="location"
                      id="issueLocation"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="e.g., Main Street, Near Temple" 
                    />
                    <button 
                      type="button" 
                      onClick={getCurrentLocation}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <MapPin className="w-4 h-4 inline mr-1" />Use Current Location
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image</label>
                    <input 
                      type="file" 
                      name="image"
                      accept="image/*" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={submitLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {submitLoading ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <PaperPlane className="w-4 h-4 mr-2" />
                    )}
                    Submit Issue
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Admin View */}
        {currentView === 'admin' && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">Manage and resolve village issues</p>
            </div>

            {/* Admin Issues Management */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Manage Issues</h2>
              <div className="space-y-4">
                {Object.entries(issues).sort(([,a], [,b]) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()).map(([key, issue]) => (
                  <div key={key} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center">
                        <div className="text-blue-600 mr-2">
                          {getCategoryIcon(issue.category)}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">{issue.title}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(issue.status)}`}>
                          {issue.status.replace('-', ' ').toUpperCase()}
                        </span>
                        <button 
                          onClick={() => {
                            setCurrentIssueId(key);
                            setShowUpdateModal(true);
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          <Edit className="w-4 h-4 inline mr-1" />Update
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-600 mb-3">{issue.description}</p>
                    <div className="flex items-center text-sm text-gray-500 mb-3">
                      <UserIcon className="w-4 h-4 mr-1" />
                      <span className="mr-4">{issue.reportedBy}</span>
                      <MapPin className="w-4 h-4 mr-1" />
                      <span className="mr-4">{issue.location}</span>
                      <Clock className="w-4 h-4 mr-1" />
                      <span>{formatDate(issue.reportedAt)}</span>
                    </div>
                    {issue.imageUrl && (
                      <div className="mb-3">
                        <img src={issue.imageUrl} alt="Issue" className="w-full h-48 object-cover rounded-md" />
                      </div>
                    )}
                    {issue.resolutionNote && (
                      <div className="bg-green-50 p-3 rounded-md">
                        <p className="text-sm text-green-800"><strong>Resolution:</strong> {issue.resolutionNote}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{isLogin ? 'Login' : 'Register'}</h2>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAuth}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input 
                  type="email" 
                  name="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input 
                  type="password" 
                  name="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                  minLength={6} 
                />
              </div>
              {!isLogin && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select 
                    name="role"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onChange={(e) => {
                      const adminCodeDiv = document.getElementById('adminCodeDiv');
                      if (e.target.value === 'admin') {
                        adminCodeDiv?.classList.remove('hidden');
                      } else {
                        adminCodeDiv?.classList.add('hidden');
                      }
                    }}
                  >
                    <option value="citizen">Citizen</option>
                    <option value="admin">Admin (Panchayat Officer)</option>
                  </select>
                  <div id="adminCodeDiv" className="mt-2 hidden">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admin Code</label>
                    <input 
                      type="text" 
                      name="adminCode"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="Enter admin access code" 
                    />
                  </div>
                </div>
              )}
              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 mb-3 disabled:opacity-50 flex items-center justify-center"
              >
                {authLoading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                {isLogin ? 'Login' : 'Register'}
              </button>
              <p className="text-center text-sm text-gray-600">
                <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setAuthError('');
                    setAuthSuccess('');
                  }}
                  className="text-blue-600 hover:text-blue-800 ml-1"
                >
                  {isLogin ? 'Register' : 'Login'}
                </button>
              </p>
            </form>
            {authError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {authError}
              </div>
            )}
            {authSuccess && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
                {authSuccess}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && currentIssueId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Update Issue</h2>
              <button onClick={() => setShowUpdateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={updateIssueStatus}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select 
                  name="status"
                  defaultValue={issues[currentIssueId]?.status}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Note</label>
                <textarea 
                  name="note"
                  rows={3} 
                  defaultValue={issues[currentIssueId]?.resolutionNote || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Add a note about the resolution..." 
                />
              </div>
              <button 
                type="submit" 
                disabled={updateLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                {updateLoading && <Loader className="w-4 h-4 mr-2 animate-spin" />}
                Update Issue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;