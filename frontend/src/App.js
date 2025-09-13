import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { Box, CircularProgress } from '@mui/material';
import { supabase } from './supabaseClient';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import SgDashboard from './components/SgDashboard';
import CdDashboard from './components/CdDashboard';
import SecDashboard from './components/SecDashboard';
import StudentDashboard from './components/StudentDashboard';

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const syncUser = async (session) => {
            if (!session) {
                setSession(null);
                return;
            }
            try {
                const response = await fetch('http://localhost:5000/api/auth/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });
                if (!response.ok) throw new Error('Sync failed');
                const userData = await response.json();
                setSession({ ...session, user: { ...session.user, ...userData } });
            } catch (error) {
                console.error('User sync failed, signing out.', error);
                await supabase.auth.signOut();
                setSession(null);
            }
        };

        const initializeApp = async () => {
            setLoading(true);
            const adminToken = localStorage.getItem('admin_token');
            if (adminToken) {
                try {
                    const decoded = jwtDecode(adminToken);
                    if (decoded.exp * 1000 > Date.now()) {
                        setSession({ user: decoded, access_token: adminToken });
                    } else {
                        localStorage.removeItem('admin_token');
                        setSession(null);
                    }
                } catch {
                    localStorage.removeItem('admin_token');
                    setSession(null);
                }
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await syncUser(session);
                } else {
                    setSession(null);
                }
            }
            setLoading(false);
        };

        initializeApp();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (_event === 'SIGNED_IN') {
                setLoading(true);
                await syncUser(session);
                setLoading(false);
            } else if (_event === 'SIGNED_OUT') {
                localStorage.removeItem('admin_token');
                setSession(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const renderDashboard = () => {
        if (!session) {
            return <Navigate to="/login" />;
        }

        let userRole = session.user?.role || session.user?.user_metadata?.role;
        // Map SG to SEF_GRUPA for backend consistency
        if (userRole === 'SG') {
            userRole = 'SEF_GRUPA';
        }

        switch (userRole) {
            case 'ADM':
                return <AdminDashboard session={session} />;
            case 'SEC':
                return <SecDashboard session={session} />;
            case 'CD':
            case 'CADRU_DIDACTIC':
                return <CdDashboard session={session} />;
            
            case 'SG':
            case 'SEF_GRUPA':
                return <SgDashboard session={session} />;
            case 'STUDENT':
                return <StudentDashboard session={session} />;
            default:
                console.warn(`Unknown role: ${userRole}, defaulting to Dashboard`);
                return <Dashboard session={session} />;
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Router>
            <div className="App">
                <Routes>
                    <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
                    <Route path="/" element={renderDashboard()} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
