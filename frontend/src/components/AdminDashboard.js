import React, { useState, useEffect, useCallback } from 'react';

import {
    AppBar, Toolbar, Typography, Button, Container, Box, Grid, Card,
    CardContent, CircularProgress, Snackbar, Alert, Divider, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper, IconButton,
    Tabs, Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
// Re-import AdminExams to ensure it's properly loaded
import AdminExams from './AdminExams';

const AdminDashboard = ({ session }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [activeTab, setActiveTab] = useState(0);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };
    
    const handleTabChange = (event, newValue) => {
        
        setActiveTab(newValue);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const usersResponse = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${session.access_token}` } });

            if (!usersResponse.ok) {
                throw new Error('Failed to fetch users.');
            }

            const usersData = await usersResponse.json();
            setUsers(usersData);

        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [session.access_token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Placeholder handlers
    const handleAddUser = () => setSnackbar({ open: true, message: 'Add user functionality not implemented yet.', severity: 'info' });
    const handleEditUser = (userId) => setSnackbar({ open: true, message: `Edit user ${userId} not implemented yet.`, severity: 'info' });
    const handleDeleteUser = (userId) => setSnackbar({ open: true, message: `Delete user ${userId} not implemented yet.`, severity: 'info' });

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Administrator Dashboard
                    </Typography>
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                </Toolbar>
            </AppBar>
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} centered>
                    <Tab label="User Management" />
                    <Tab label="Exam Management" />
                </Tabs>
            </Box>
            

            
            {activeTab === 0 ? (
                <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="h5">User Management</Typography>
                                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddUser}>
                                            Add User
                                        </Button>
                                    </Box>
                                </CardContent>
                                <Divider />
                                {loading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                                ) : (
                                    <TableContainer component={Paper} variant="outlined">
                                        <Table aria-label="user management table">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Full Name</TableCell>
                                                    <TableCell>Email</TableCell>
                                                    <TableCell>Role</TableCell>
                                                    <TableCell align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {users.map((user) => (
                                                    <TableRow key={user.id} hover>
                                                        <TableCell component="th" scope="row">{user.full_name}</TableCell>
                                                        <TableCell>{user.email}</TableCell>
                                                        <TableCell>{user.role_name}</TableCell>
                                                        <TableCell align="right">
                                                            <IconButton onClick={() => handleEditUser(user.id)} size="small">
                                                                <EditIcon />
                                                            </IconButton>
                                                            <IconButton onClick={() => handleDeleteUser(user.id)} size="small">
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Card>
                        </Grid>
                    </Grid>
                </Container>
            ) : (
                <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5">Exam Management</Typography>
                        </CardContent>
                        <Divider />
                        <Box sx={{ p: 2 }}>
                           
                            {session && session.access_token ? (
                                <AdminExams session={session} />
                            ) : (
                                <Box sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography color="error">Session or access token is missing</Typography>
                                </Box>
                            )}
                        </Box>
                    </Card>
                </Container>
            )}
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AdminDashboard;
