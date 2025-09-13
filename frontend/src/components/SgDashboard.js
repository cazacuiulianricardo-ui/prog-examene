import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
    AppBar, Toolbar, Typography, Button, Container, Box, Grid, Card,
    CardContent, List, ListItem, ListItemText, CircularProgress, Snackbar, Alert, Divider,
    Dialog, DialogActions, DialogContent, DialogTitle, TextField, MenuItem, FormControl,
    InputLabel, Select, FormHelperText, Paper, Chip, IconButton, Tooltip
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RoomIcon from '@mui/icons-material/Room';
import PersonIcon from '@mui/icons-material/Person';
import SchoolIcon from '@mui/icons-material/School';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const SgDashboard = ({ session }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null);
    const [proposedDate, setProposedDate] = useState(null);
    const [selectedHour, setSelectedHour] = useState('');

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const handleOpenDialog = (exam) => {
        console.log('Opening dialog with exam:', exam);
        console.log('Room ID type:', typeof exam.room_id);
        console.log('Room ID value:', exam.room_id);
        
        setSelectedExam(exam);
        setProposedDate(null);
        setSelectedHour('');
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedExam(null);
        setProposedDate(null);
        setSelectedHour('');
    };

    // Room selection is now auto-inserted from exam data

    const handleSubmitProposal = async () => {
        if (!proposedDate || !selectedExam || !selectedHour) {
            return;
        }
        
        // Debug room_id detection
        console.log('Room ID check:', {
            hasRoomId: !!selectedExam.room_id,
            roomId: selectedExam.room_id,
            roomIdType: typeof selectedExam.room_id,
            roomName: selectedExam.room_name
        });
        
        // Use room_id if available, otherwise try to extract from room_name
        let roomId = selectedExam.room_id;
        
        // Backend now includes room_id in the response
        // If room_id is still missing, show an error message
        if (!roomId) {
            console.log('No room_id found in exam data');
        }
        
        if (!roomId) {
            setSnackbar({ open: true, message: 'This exam does not have a room assigned by Secretariat yet.', severity: 'error' });
            return;
        }

        // Debug log to see what we're sending
        console.log('Selected exam:', selectedExam);
        
        // Room ID was already determined in the validation check above
        
        console.log('Using room_id:', roomId);
        
        try {
            const requestBody = {
                exam_date: proposedDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
                start_hour: selectedHour,
                room_id: roomId
            };
            
            console.log('Sending proposal data:', requestBody);
            
            const response = await fetch(`/api/sg/exams/${selectedExam.id}/propose`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(requestBody)
            });

            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to propose exam date.');
            }
            
            setSnackbar({ open: true, message: 'Exam schedule proposed successfully!', severity: 'success' });
            handleCloseDialog();
            fetchExams(); // Refresh the list
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        }
    };

    const fetchExams = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/sg/exams', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch exams.');
            }
            const data = await response.json();
            
            // Debug log to see the exam data structure
            console.log('Fetched exams:', data);
            
            setExams(data);
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [session.access_token]);

    useEffect(() => {
        fetchExams();
    }, [fetchExams]);

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static" color="primary" elevation={3}>
                <Toolbar>
                    <SchoolIcon sx={{ mr: 2 }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                        Meniu șef grupă
                    </Typography>
                    <Button color="inherit" variant="outlined" onClick={handleLogout} sx={{ borderRadius: 2 }}>
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                            <Box sx={{ p: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <ScheduleIcon sx={{ mr: 1 }} /> Examenele mele
                                </Typography>
                                <Typography variant="body1">
                                    Propune sau vizualizează data si ora examenului.
                                </Typography>
                            </Box>
                            <List sx={{ bgcolor: 'background.paper', py: 0 }}>
                                {loading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}><CircularProgress /></Box>
                                ) : exams.length > 0 ? (
                                     exams.map(exam => {
                                         console.log('Exam object from SgDashboard:', JSON.stringify(exam));
                                         return (
                                             <ListItem key={exam.id} sx={{ 
                                                    py: 2, 
                                                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                                                    flexDirection: { xs: 'column', sm: 'row' },
                                                    alignItems: { xs: 'flex-start', sm: 'center' }
                                                }}>
                                                    <Box sx={{ flex: 1, width: '100%' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                            <Typography variant="h6" sx={{ mr: 2 }}>
                                                                {exam.discipline_name}
                                                            </Typography>
                                                            <Chip 
                                                                label={exam.exam_type} 
                                                                color={exam.exam_type === 'EXAM' ? 'primary' : 'secondary'} 
                                                                size="small" 
                                                                sx={{ mr: 1 }}
                                                            />
                                                            <Chip 
                                                                label={exam.status} 
                                                                color={
                                                                    exam.status === 'DRAFT' ? 'default' :
                                                                    exam.status === 'PROPOSED' ? 'info' :
                                                                    exam.status === 'APPROVED' ? 'success' :
                                                                    exam.status === 'REJECTED' ? 'error' : 'default'
                                                                }
                                                                size="small" 
                                                            />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <PersonIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {exam.main_teacher}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <EventIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {exam.exam_date && exam.exam_date !== 'null' ? 
                                                                        new Date(exam.exam_date).toLocaleDateString() : 'Data nu este setată'}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <AccessTimeIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {exam.start_hour ? `${exam.start_hour}:00` : 'Ora nu este setată'}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <RoomIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {exam.room_name || 'Room not assigned'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        size="medium"
                                                        sx={{ mt: { xs: 1, sm: 0 }, borderRadius: 2 }}
                                                        onClick={() => handleOpenDialog(exam)}
                                                        disabled={!['DRAFT', 'REJECTED', 'CANCELLED'].includes((exam.status || '').trim().toUpperCase())}
                                                        startIcon={<EventIcon />}
                                                    >
                                                        {['DRAFT'].includes((exam.status || '').trim().toUpperCase()) ? 'Propose Schedule' : 'Reschedule'}
                                                    </Button>
                                             </ListItem>
                                         );
                                     })
                                 ) : (
                                     <ListItem sx={{ py: 4 }}>
                                         <Box sx={{ width: '100%', textAlign: 'center' }}>
                                             <Typography variant="body1" color="text.secondary">
                                                 No exams assigned to your group.
                                             </Typography>
                                         </Box>
                                     </ListItem>
                                 )}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', pb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <EventIcon sx={{ mr: 1 }} />
                        Propune data si ora examenului {selectedExam?.discipline_name}
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Data examenului"
                                value={proposedDate}
                                onChange={(newValue) => setProposedDate(newValue)}
                                renderInput={(params) => <TextField {...params} fullWidth />}
                                shouldDisableDate={(date) => {
                                    // 0 = Sunday, 6 = Saturday
                                    const day = date.getDay();
                                    return day === 0 || day === 6; // Disable weekends
                                }}
                                helperText="Selectează doar luni, marți, miercuri, joi si vineri"
                            />
                        </LocalizationProvider>
                        
                        <FormControl fullWidth>
                            <InputLabel id="hour-select-label">Ora examenului</InputLabel>
                            <Select
                                labelId="hour-select-label"
                                value={selectedHour}
                                label="Start Hour"
                                onChange={(e) => setSelectedHour(e.target.value)}
                                disabled={!proposedDate}
                            >
                                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => (
                                    <MenuItem key={hour} value={hour}>{hour}:00</MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>Examenul durează 2 ore</FormHelperText>
                        </FormControl>
                        
                        <TextField
                            fullWidth
                            label="Sală"
                            value={selectedExam?.room_name || 'Not assigned'}
                            disabled={true}
                            helperText="Sala este asignată de Secretariat"
                            sx={{ mt: 2 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 2 }}>
                    <Button onClick={handleCloseDialog} variant="outlined" sx={{ borderRadius: 2 }}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmitProposal} 
                        variant="contained" 
                        disabled={!proposedDate || !selectedHour}
                        sx={{ borderRadius: 2 }}
                        startIcon={<EventIcon />}
                    >
                        Propune
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SgDashboard;
