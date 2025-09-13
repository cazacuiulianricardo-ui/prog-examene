import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
    AppBar, Toolbar, Typography, Button, Container, Card, 
    CardContent, Grid, CircularProgress, Box, Tabs, Tab, Paper
} from '@mui/material';
import UserManagement from './UserManagement';
import RoomManagement from './RoomManagement';
import DisciplineManagement from './DisciplineManagement';
import StudentDetails from './StudentDetails';

const Dashboard = ({ session }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminTab, setAdminTab] = useState(0);
    const [userDetails, setUserDetails] = useState(null);

    useEffect(() => {
        const fetchExams = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/exams', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setExams(data);
            } catch (error) {
                console.error("Failed to fetch exams:", error);
            }
            setLoading(false);
        };

        if (session?.access_token) {
            fetchExams();

            const userRole = session?.user?.role;

            if (userRole === 'ADMIN') {
                setUserDetails({ role: 'ADMIN', ...session.user });
            } else {
                const token = localStorage.getItem('token') || session.access_token;
                fetch('http://localhost:5000/api/auth/sync', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Sync failed with status: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data.id) {
                        setUserDetails(data);
                    } else {
                        console.error('Sync error: Invalid data received', data);
                    }
                })
                .catch(err => {
                    console.error('An error occurred while syncing user data:', err);
                });
            }
        }
    }, [session]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleAdminTabChange = (event, newValue) => {
        setAdminTab(newValue);
    };

    const handleUserDetailsUpdate = (updatedDetails) => {
        setUserDetails(updatedDetails);
    };

    const userRole = session?.user?.role || userDetails?.role;
    const isAdmin = userRole === 'ADMIN';
    const isStudent = userRole === 'STUDENT' || userRole === 'SEF_GRUPA';

    return (
        <Box sx={{ flexGrow: 1, bgcolor: 'grey.100', minHeight: '100vh' }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Meniu administrator
                    </Typography>
                    <Typography variant="body2" sx={{ mr: 2 }}>
                        {session.user.email}
                    </Typography>
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                </Toolbar>
            </AppBar>
            <Container sx={{ py: 4 }}>
                {isAdmin && (
                    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                        <Tabs value={adminTab} onChange={handleAdminTabChange} centered>
                            <Tab label="Panou utilizatori" />
                            <Tab label="Panou săli" />
                            <Tab label="Panou discipline" />
                        </Tabs>
                        <Box sx={{ mt: 3 }}>
                            {adminTab === 0 && <UserManagement session={session} />}
                            {adminTab === 1 && <RoomManagement />}
                            {adminTab === 2 && <DisciplineManagement />}
                        </Box>
                    </Paper>
                )}

                {isStudent && userDetails && (
                    <StudentDetails 
                        session={session} 
                        userDetails={userDetails} 
                        onUpdate={handleUserDetailsUpdate} 
                    />
                )}

                {!isAdmin && (
                    <Paper elevation={3} sx={{ p: 3 }}>
                        <Typography variant="h5" component="h2" gutterBottom>
                            Exam Schedule
                        </Typography>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : exams.length > 0 ? (
                            <Grid container spacing={3}>
                                {exams.map(exam => (
                                    <Grid item xs={12} sm={6} md={4} key={exam.id}>
                                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', '&:hover': { boxShadow: 6, transform: 'scale(1.02)' }, transition: 'transform 0.2s, box-shadow 0.2s' }}>
                                            <CardContent sx={{ flexGrow: 1 }}>
                                                <Typography variant="h6" component="div" gutterBottom>
                                                    {exam.discipline || exam.name}
                                                </Typography>
                                                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                                                    Status: {exam.status}
                                                </Typography>
                                                <Typography variant="body2">
                                                    Date: {new Date(exam.date || exam.final_date).toLocaleString()}
                                                    <br />
                                                    Room: {exam.room || 'Not set'}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        ) : (
                            <Typography variant="body1" sx={{ textAlign: 'center' }}>
                                Niciun examen programat.
                            </Typography>
                        )}
                    </Paper>
                )}
            </Container>
        </Box>
    );
};

export default Dashboard;
