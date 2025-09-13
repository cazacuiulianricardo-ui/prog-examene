import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
    AppBar, Toolbar, Typography, Button, Box, Snackbar, Alert
} from '@mui/material';
import StudentExams from './StudentExams';

const StudentDashboard = ({ session }) => {
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Meniu student
                    </Typography>
                    <Typography variant="body2" sx={{ mr: 2 }}>
                        {session.user.email}
                    </Typography>
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                </Toolbar>
            </AppBar>
            
            <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="h5" align="center" gutterBottom>
                   
                </Typography>
            </Box>
            
            <StudentExams session={session} />
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default StudentDashboard;
