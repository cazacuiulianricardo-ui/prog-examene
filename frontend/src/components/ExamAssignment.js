import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Box, Grid, Card, CardContent, CardActions, Button,
    FormControl, InputLabel, Select, MenuItem, Divider,
    CircularProgress, Snackbar, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Chip
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const ExamAssignment = ({ session }) => {
    const [disciplines, setDisciplines] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [studentGroups, setStudentGroups] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [assignments, setAssignments] = useState([]);
    const [formData, setFormData] = useState({
        discipline_id: '',
        student_group: '',
        exam_type: 'EXAM',
        main_teacher_id: '',
        second_teacher_id: '',
        room_id: ''
    });

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            
            // Fetch disciplines
            const disciplinesResponse = await fetch('/api/sec/disciplines', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!disciplinesResponse.ok) throw new Error('Failed to fetch disciplines');
            const disciplinesData = await disciplinesResponse.json();
            setDisciplines(disciplinesData);
            
            // Fetch teachers
            const teachersResponse = await fetch('/api/sec/teachers', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!teachersResponse.ok) throw new Error('Failed to fetch teachers');
            const teachersData = await teachersResponse.json();
            setTeachers(teachersData);
            
            // Fetch student groups
            const groupsResponse = await fetch('/api/student-groups', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!groupsResponse.ok) throw new Error('Asignarea examenului nu a putut fi creata');
            const groupsData = await groupsResponse.json();
            setStudentGroups(groupsData);
            
            // Fetch rooms
            const roomsResponse = await fetch('/api/rooms', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!roomsResponse.ok) throw new Error('Failed to fetch rooms');
            const roomsData = await roomsResponse.json();
            setRooms(roomsData);
            
            // Fetch existing exam assignments
            const assignmentsResponse = await fetch('/api/sec/exams', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!assignmentsResponse.ok) throw new Error('Asignarea examenului nu a putut fi creata');
            const assignmentsData = await assignmentsResponse.json();
            setAssignments(assignmentsData);
            
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [session.access_token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async () => {
        // Validate form data
        const requiredFields = ['discipline_id', 'student_group', 'exam_type', 'main_teacher_id', 'second_teacher_id', 'room_id'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            setSnackbar({
                open: true,
                message: `Te rog sa completezi toate campurile obligatorii: ${missingFields.join(', ')}`,
                severity: 'warning'
            });
            return;
        }
        
        if (formData.main_teacher_id === formData.second_teacher_id) {
            setSnackbar({
                open: true,
                message: 'Profesorul principal si profesorul de suplimentar nu pot fi acelasi',
                severity: 'warning'
            });
            return;
        }
        
        try {
            setSubmitting(true);
            
            const response = await fetch('/api/sec/exams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Asignarea examenului nu a putut fi creata');
            }
            
            // Reset form and refresh data
            setFormData({
                discipline_id: '',
                student_group: '',
                exam_type: 'EXAM',
                main_teacher_id: '',
                second_teacher_id: '',
                room_id: ''
            });
            
            setSnackbar({
                open: true,
                message: 'Asignarea examenului a fost creata cu succes',
                severity: 'success'
            });
            
            // Refresh assignments
            fetchData();
            
        } catch (error) {
            setSnackbar({
                open: true,
                message: error.message,
                severity: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusChip = (status) => {
        let color = 'default';
        switch (status) {
            case 'DRAFT':
                color = 'default';
                break;
            case 'PROPOSED':
                color = 'primary';
                break;
            case 'ACCEPTED':
                color = 'info';
                break;
            case 'REJECTED':
                color = 'error';
                break;
            case 'CANCELLED':
                color = 'warning';
                break;
            case 'CONFIRMED':
                color = 'success';
                break;
            default:
                color = 'default';
        }
        return <Chip label={status} color={color} size="small" />;
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Card>
                <CardContent>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#1976d2' }}>
                        Asignare examene
                    </Typography>
                    <Typography color="text.secondary" paragraph sx={{ mb: 3 }}>
                        Creeaza asignari examene pentru grupe studenti. Liderii grupei vor fi notificați pentru a propune date.
                    </Typography>
                    
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Discipline</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="discipline_id"
                                        value={formData.discipline_id}
                                        onChange={handleInputChange}
                                        label="Disciplina"
                                    >
                                        {disciplines.map((discipline) => (
                                            <MenuItem key={discipline.id} value={discipline.id}>
                                                {discipline.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Grupă</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="student_group"
                                        value={formData.student_group}
                                        onChange={handleInputChange}
                                        label="Grupă studenti"
                                    >
                                        {studentGroups.map((group) => (
                                            <MenuItem key={group.id || group.name} value={group.name || group}>
                                                {group.name || group}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Tip examen</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="exam_type"
                                        value={formData.exam_type}
                                        onChange={handleInputChange}
                                        label="Tip examen"
                                    >
                                        <MenuItem value="EXAM">Examen</MenuItem>
                                        <MenuItem value="PROJECT">Proiect</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Profesor principal</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="main_teacher_id"
                                        value={formData.main_teacher_id}
                                        onChange={handleInputChange}
                                        label="Profesor principal"
                                    >
                                        {teachers.map((teacher) => (
                                            <MenuItem key={teacher.id} value={teacher.id}>
                                                {teacher.full_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Profesor secundar</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="second_teacher_id"
                                        value={formData.second_teacher_id}
                                        onChange={handleInputChange}
                                        label="Profesor secundar"
                                    >
                                        {teachers.map((teacher) => (
                                            <MenuItem key={teacher.id} value={teacher.id}>
                                                {teacher.full_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth variant="outlined" sx={{ 
                                    '& .MuiOutlinedInput-root': { 
                                        borderRadius: '8px',
                                        fontSize: '0.875rem'
                                    }, 
                                    '& .MuiInputLabel-root': { 
                                        fontWeight: 500,
                                        fontSize: '0.875rem'
                                    },
                                    '& .MuiMenuItem-root': {
                                        fontSize: '0.875rem'
                                    }
                                }}>
                                    <InputLabel>Sală</InputLabel>
                                    <Select
                                        MenuProps={{
                                            PaperProps: {
                                                style: {
                                                    maxHeight: 300,
                                                    borderRadius: '8px',
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '0.875rem',
                                                        padding: '6px 16px'
                                                    }
                                                },
                                            },
                                        }}
                                        name="room_id"
                                        value={formData.room_id}
                                        onChange={handleInputChange}
                                        label="Sală"
                                    >
                                        {rooms.map((room) => (
                                            <MenuItem key={room.id} value={room.id}>
                                                {room.name} ({room.building_name}, Capacity: {room.capacity})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    )}
                </CardContent>
                <Divider />
                <CardActions>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={handleSubmit}
                        disabled={loading || submitting}
                        sx={{
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontWeight: 600,
                            textTransform: 'none',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
                            '&:hover': {
                                boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)'
                            }
                        }}
                    >
                        {submitting ? <CircularProgress size={24} /> : 'Alege examen'}
                    </Button>
                </CardActions>
                
                <Divider />
                
                <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#1976d2', mt: 2 }}>
                        Asignări examene
                    </Typography>
                    
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <TableContainer component={Paper} sx={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                            <Table sx={{ minWidth: 650 }}>
                                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                                    <TableRow>
                                        <TableCell>Discipline</TableCell>
                                        <TableCell>Grupă</TableCell>
                                        <TableCell>Tip</TableCell>
                                        <TableCell>Profesor principal</TableCell>
                                        <TableCell>Profesor suplimentar</TableCell>
                                        <TableCell>Sală</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {assignments.length > 0 ? (
                                        assignments.map((assignment) => (
                                            <TableRow key={assignment.id}>
                                                <TableCell>{assignment.discipline_name}</TableCell>
                                                <TableCell>{assignment.student_group}</TableCell>
                                                <TableCell>{assignment.exam_type}</TableCell>
                                                <TableCell>{assignment.main_teacher_name}</TableCell>
                                                <TableCell>{assignment.second_teacher_name}</TableCell>
                                                <TableCell>{assignment.room_name || 'Not assigned'}</TableCell>
                                                <TableCell>{getStatusChip(assignment.status)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                Nu există examene confirmate.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>
            
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert 
                    onClose={handleCloseSnackbar} 
                    severity={snackbar.severity} 
                    sx={{ 
                        width: '100%',
                        borderRadius: '8px',
                        '& .MuiAlert-message': { fontWeight: 500 }
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </LocalizationProvider>
    );
};

export default ExamAssignment;