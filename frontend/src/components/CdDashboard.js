import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import {
    AppBar, Toolbar, Typography, Button, Box, Snackbar, Alert
} from '@mui/material';
import TeacherExams from './TeacherExams';

const CdDashboard = ({ session }) => {
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
                        Meniu profesor
                    </Typography>
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                </Toolbar>
            </AppBar>
            
            <TeacherExams session={session} />
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default CdDashboard;
