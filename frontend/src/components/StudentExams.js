import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Container, Box, Grid, CircularProgress, Snackbar, Alert, Paper,
    Avatar, TextField, Button
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RoomIcon from '@mui/icons-material/Room';
import PersonIcon from '@mui/icons-material/Person';
import MenuBookIcon from '@mui/icons-material/MenuBook';

const StudentExams = ({ session }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [studentInfo, setStudentInfo] = useState({
        student_group: '',
        year_of_study: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setStudentInfo(prev => ({
            ...prev,
            [name]: value
        }));
    };
    
    const handleEditToggle = () => {
        setIsEditing(!isEditing);
    };
    
    const handleSaveStudentInfo = async () => {
        try {
            setSaving(true);
            
            const response = await fetch('/api/student/info', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    student_group: studentInfo.student_group,
                    year_of_study: studentInfo.year_of_study ? parseInt(studentInfo.year_of_study, 10) : null
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save student information.');
            }
            
            const data = await response.json();
            setStudentInfo({
                student_group: data.student_group || '',
                year_of_study: data.year_of_study || ''
            });
            
            setSnackbar({
                open: true,
                message: 'Detalii academice salvate cu succes!',
                severity: 'success'
            });
            
            // After saving student info, refresh exams to show exams for the updated group
            fetchExams();
            
            setIsEditing(false);
        } catch (error) {
            setSnackbar({
                open: true,
                message: error.message || 'Failed to save student information.',
                severity: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const fetchStudentInfo = useCallback(async () => {
        try {
            const response = await fetch('/api/student/info', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            if (!response.ok) {
                // If 404, it means the student info is not set yet
                if (response.status === 404) {
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch student information.');
            }
            
            const data = await response.json();
            setStudentInfo({
                student_group: data.student_group || '',
                year_of_study: data.year_of_study || ''
            });
        } catch (error) {
            console.error('Error fetching student info:', error);
            // Don't show error snackbar for this, as it's not critical
        }
    }, [session.access_token]);

    const fetchExams = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/student/exams', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch exams.');
            }
            
            const data = await response.json();
            // Filter to only show confirmed exams
            const confirmedExams = data.filter(exam => exam.status === 'CONFIRMED');
            setExams(confirmedExams);
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [session.access_token]);

    useEffect(() => {
        fetchStudentInfo();
        fetchExams();
    }, [fetchStudentInfo, fetchExams]);

    // Format date nicely
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Not set';
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString(undefined, options);
    };
    
    // Format time nicely
    const formatTime = (hour, duration) => {
        if (!hour) return 'Not set';
        const endHour = parseInt(hour) + Math.floor(duration / 60);
        const endMinutes = duration % 60;
        return `${hour}:00 - ${endHour}:${endMinutes === 0 ? '00' : endMinutes}`;
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2', mb: 3, textAlign: 'center' }}>
                Examenele mele
            </Typography>
            
            {/* Student Information Card */}
            <Paper 
                elevation={3} 
                sx={{ 
                    mb: 4, 
                    borderRadius: '16px', 
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { 
                        transform: 'translateY(-4px)', 
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)' 
                    }
                }}
            >
                <Box sx={{ 
                    p: 2, 
                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ bgcolor: 'white', color: '#1976d2', mr: 2 }}>
                            <PersonIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Detalii academice
                        </Typography>
                    </Box>
                    <Button 
                        variant="contained" 
                        color="inherit" 
                        onClick={handleEditToggle}
                        size="small"
                        startIcon={isEditing ? null : <EventIcon />}
                        sx={{ 
                            color: '#1976d2', 
                            bgcolor: 'white',
                            '&:hover': { bgcolor: '#f5f5f5' }
                        }}
                    >
                        {isEditing ? "Cancel" : "Edit"}
                    </Button>
                </Box>
                <Box sx={{ p: 2.5 }}>
                    
                    {isEditing ? (
                        <Box component="form" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                            <TextField
                                name="student_group"
                                label="Grupă"
                                value={studentInfo.student_group}
                                onChange={handleInputChange}
                                fullWidth
                                variant="outlined"
                                size="small"
                                placeholder="e.g., 3A4"
                            />
                            <TextField
                                name="year_of_study"
                                label="Anul de studiu"
                                value={studentInfo.year_of_study}
                                onChange={handleInputChange}
                                fullWidth
                                variant="outlined"
                                size="small"
                                placeholder="e.g., 3"
                                type="number"
                                inputProps={{ min: 1, max: 6 }}
                            />
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleSaveStudentInfo}
                                disabled={saving}
                                sx={{ minWidth: '120px' }}
                            >
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4 }}>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Grupă
                                </Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {studentInfo.student_group || "N/A"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Anul de studiu
                                </Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {studentInfo.year_of_study || "N/A"}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Paper>
            
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 6 }}>
                    <CircularProgress size={60} />
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {exams.length > 0 ? exams.map((exam) => (
                        <Grid item xs={12} md={6} key={exam.id}>
                            <Paper 
                                elevation={3} 
                                sx={{ 
                                    borderRadius: '16px', 
                                    overflow: 'hidden',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    '&:hover': { 
                                        transform: 'translateY(-4px)', 
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)' 
                                    }
                                }}
                            >
                                <Box sx={{ 
                                    p: 2, 
                                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                                    color: 'white'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                        <Avatar sx={{ bgcolor: 'white', color: '#1976d2', mr: 2 }}>
                                            <MenuBookIcon />
                                        </Avatar>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            {exam.discipline_name}
                                        </Typography>
                                    </Box>
                                    <Typography variant="subtitle2">
                                        {exam.exam_type}
                                    </Typography>
                                </Box>
                                
                                <Box sx={{ p: 2.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <EventIcon sx={{ color: '#1976d2', mr: 2 }} />
                                        <Typography variant="body1">
                                            {formatDate(exam.exam_date)}
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <AccessTimeIcon sx={{ color: '#1976d2', mr: 2 }} />
                                        <Typography variant="body1">
                                            {formatTime(exam.start_hour, exam.duration)}
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <RoomIcon sx={{ color: '#1976d2', mr: 2 }} />
                                        <Typography variant="body1">
                                            {exam.room_name || 'Not assigned'}
                                        </Typography>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                        <PersonIcon sx={{ color: '#1976d2', mr: 2, mt: 0.5 }} />
                                        <Typography variant="body1">
                                            {exam.teachers && exam.teachers.length > 0 ? 
                                                exam.teachers.join(', ') : 'No teachers assigned'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Grid>
                    )) : (
                        <Grid item xs={12}>
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '16px' }}>
                                <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                    No confirmed exams scheduled yet.
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                                    Check back later for your exam schedule.
                                </Typography>
                            </Paper>
                        </Grid>
                    )}
                </Grid>
            )}

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default StudentExams;
