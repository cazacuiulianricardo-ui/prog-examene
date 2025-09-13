import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Container, Box, Grid, Card, CardContent, List, ListItem, 
    ListItemText, CircularProgress, Snackbar, Alert, Divider, Chip, Button,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    FormControl, InputLabel, Select, MenuItem, TextField, Tabs, Tab
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Helper function to format dates properly
const formatDate = (dateValue) => {
    // Handle null, undefined, or "null" string
    if (!dateValue || dateValue === 'null') {
        return 'Not set';
    }
    
    // Try to parse the date
    const parsedDate = new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
        return 'Not set';
    }
    
    // Return formatted date
    return parsedDate.toLocaleDateString();
};

const TeacherExams = ({ session }) => {
    const [exams, setExams] = useState([]);
    const [filteredExams, setFilteredExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [reviewDialog, setReviewDialog] = useState({
        open: false,
        examId: null,
        action: '',
        alternateDate: null,
        alternateHour: ''
    });
    const [tabValue, setTabValue] = useState(0);

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const fetchExams = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/cd/exams', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch exams');
            }
            
            const data = await response.json();
            setExams(data);
        } catch (error) {
            console.error('Error fetching exams:', error);
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.access_token]);
    
    const filterExamsByTab = useCallback((tabIndex) => {
        // Ensure exams is an array before filtering
        const examArray = Array.isArray(exams) ? exams : [];
        
        switch (tabIndex) {
            case 0: // All exams
                setFilteredExams(examArray);
                break;
            case 1: // Rejected
                setFilteredExams(examArray.filter(exam => exam.status?.toUpperCase() === 'REJECTED'));
                break;
            case 2: // Confirmed
                setFilteredExams(examArray.filter(exam => exam.status?.toUpperCase() === 'CONFIRMED'));
                break;
            default:
                setFilteredExams(examArray);
        }
    }, [exams, setFilteredExams]);
    
    useEffect(() => {
        if (exams.length > 0) {
            filterExamsByTab(tabValue);
        } else {
            setFilteredExams([]);
        }
    }, [exams, tabValue, filterExamsByTab]);
    
    // Safe tab change handler to prevent onClick errors
    const handleTabChange = (event, newValue) => {
        if (typeof newValue === 'number') {
            setTabValue(newValue);
        }
    };

    const openReviewDialog = (examId, action) => {
        setReviewDialog({
            open: true,
            examId,
            action,
            alternateDate: null,
            alternateHour: ''
        });
    };

    const handleCloseDialog = () => {
        setReviewDialog({
            ...reviewDialog,
            open: false
        });
    };

    const handleReviewAction = async () => {
        try {
            const { examId, action, alternateDate, alternateHour } = reviewDialog;
            
            const requestBody = { action };
            
            // If action is ALTERNATE, include alternate date and hour
            if (action === 'ALTERNATE') {
                if (!alternateDate || !alternateHour) {
                    setSnackbar({ 
                        open: true, 
                        message: 'Please provide both alternate date and hour', 
                        severity: 'error' 
                    });
                    return;
                }
                
                requestBody.alternate_date = alternateDate.toISOString().split('T')[0];
                requestBody.alternate_hour = alternateHour;
            }
            
            const response = await fetch(`/api/cd/exams/${examId}/review`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(requestBody)
            });
            
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || `Failed to ${action.toLowerCase()} exam.`);
            }
            
            setSnackbar({ 
                open: true, 
                message: `Exam has been ${action.toLowerCase()}ed successfully.`, 
                severity: 'success' 
            });
            
            // Close dialog and refresh exams
            handleCloseDialog();
            fetchExams();
            
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        }
    };

    const handleConfirmExam = async (examId) => {
        try {
            const response = await fetch(`/api/cd/exams/${examId}/confirm`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to confirm exam.');
            }
            
            setSnackbar({ 
                open: true, 
                message: 'Exam has been confirmed successfully.', 
                severity: 'success' 
            });
            
            // Refresh exams
            fetchExams();
            
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        }
    };

    const getStatusChip = (status) => {
        const normalizedStatus = (status || '').toUpperCase();
        let color = 'default';
        switch (normalizedStatus) {
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
        return <Chip label={normalizedStatus} color={color} size="small" />;
    };

    const renderExamActions = (exam) => {
        const status = (exam.status || '').toUpperCase();
        switch (status) {
            case 'PROPOSED':
                return (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                            variant="contained" 
                            color="success" 
                            size="small"
                            startIcon={<CheckCircleOutlineIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                            onClick={() => openReviewDialog(exam.id, 'ACCEPT')}
                        >
                            Accept
                        </Button>
                        <Button 
                            variant="contained" 
                            color="error" 
                            size="small"
                            startIcon={<CancelOutlinedIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                            onClick={() => openReviewDialog(exam.id, 'REJECT')}
                        >
                            Reject
                        </Button>
                        <Button 
                            variant="contained" 
                            color="warning" 
                            size="small"
                            startIcon={<AccessTimeIcon />}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                            onClick={() => openReviewDialog(exam.id, 'ALTERNATE')}
                        >
                            Alternate
                        </Button>
                    </Box>
                );
            case 'ACCEPTED':
                return (
                    <Button 
                        variant="contained" 
                        color="success" 
                        size="small"
                        startIcon={<CheckCircleOutlineIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                        onClick={() => handleConfirmExam(exam.id)}
                    >
                        Confirm
                    </Button>
                );
            default:
                return null;
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card sx={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                        <CardContent sx={{ backgroundColor: '#f5f9ff' }}>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#1976d2' }}>Examenele mele</Typography>
                            <Typography color="text.secondary" sx={{ mb: 1 }}>
                                Verifică programările și gestionează examenele tale
                            </Typography>
                        </CardContent>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#f5f9ff' }}>
                            <Tabs 
                                value={tabValue} 
                                onChange={handleTabChange}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 500,
                                        fontSize: '0.9rem'
                                    }
                                }}
                            >
                                <Tab label="Toate examenele" />
                                <Tab label="Refuzate" />
                                <Tab label="Confirmate" />
                            </Tabs>
                        </Box>
                        <Divider />
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <List sx={{ p: 0 }}>
                                {filteredExams.length > 0 ? filteredExams.map((exam) => (
                                    <ListItem 
                                        key={exam.id} 
                                        divider 
                                        sx={{ 
                                            '&:hover': { backgroundColor: 'action.hover' },
                                            py: 2
                                        }}
                                    >
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12} sm={3}>
                                                <ListItemText 
                                                    primary={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{exam.discipline_name}</Typography>} 
                                                    secondary={<Typography variant="body2">{`Tip examen: ${exam.exam_type}`}</Typography>}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={2}>
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                    <strong>Grupă:</strong> <span style={{ marginLeft: '4px' }}>{exam.student_group}</span>
                                                </Typography>
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <strong>Rol:</strong> <span style={{ marginLeft: '4px' }}>{exam.teacher_role}</span>
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={3}>
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                    <strong>Data:</strong> <span style={{ marginLeft: '4px' }}>{formatDate(exam.exam_date)}</span>
                                                </Typography>
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                    <strong>Oră:</strong> <span style={{ marginLeft: '4px' }}>{exam.start_hour ? `${exam.start_hour}:00 (${exam.duration || 120} min)` : "Not set"}</span>
                                                </Typography>
                                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <strong>Sală:</strong> <span style={{ marginLeft: '4px' }}>{exam.room_name || "Not assigned"}</span>
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                    {getStatusChip(exam.status)}
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                    {renderExamActions(exam)}
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </ListItem>
                                )) : (
                                    <ListItem sx={{ py: 4 }}>
                                        <Box sx={{ width: '100%', textAlign: 'center' }}>
                                            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                                                No exams found in this category.
                                            </Typography>
                                        </Box>
                                    </ListItem>
                                )}
                            </List>
                        )}
                    </Card>
                </Grid>
            </Grid>

            {/* Review Dialog */}
            <Dialog 
                open={reviewDialog.open} 
                onClose={handleCloseDialog}
                PaperProps={{
                    sx: {
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                    }
                }}
            >
                <DialogTitle sx={{ backgroundColor: '#f5f9ff', pb: 1 }}>
                    {reviewDialog.action === 'ACCEPT' && 'Accept Exam Proposal'}
                    {reviewDialog.action === 'REJECT' && 'Reject Exam Proposal'}
                    {reviewDialog.action === 'ALTERNATE' && 'Propose Alternate Date/Time'}
                    {reviewDialog.action === 'CANCEL' && 'Cancel Exam'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {reviewDialog.action === 'ACCEPT' && 'Ești sigur că doriți să acceptați această propunere de examen?'}
                        {reviewDialog.action === 'REJECT' && 'Ești sigur că doriți să refuzați această propunere de examen?'}
                        {reviewDialog.action === 'ALTERNATE' && 'Specificați o dată și o oră alternativă pentru acest examen:'}
                        {reviewDialog.action === 'CANCEL' && 'Ești sigur că doriți să anulați acest examen?'}
                    </DialogContentText>
                    
                    {reviewDialog.action === 'ALTERNATE' && (
                        <Box sx={{ mt: 2 }}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Data alternativă"
                                    value={reviewDialog.alternateDate}
                                    onChange={(newDate) => setReviewDialog({
                                        ...reviewDialog,
                                        alternateDate: newDate
                                    })}
                                    renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
                                />
                            </LocalizationProvider>
                            
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Oră alternativă</InputLabel>
                                <Select
                                    value={reviewDialog.alternateHour}
                                    label="Oră alternativă"
                                    onChange={(e) => setReviewDialog({
                                        ...reviewDialog,
                                        alternateHour: e.target.value
                                    })}
                                >
                                    {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => (
                                        <MenuItem key={hour} value={hour}>
                                            {hour}:00
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, backgroundColor: '#fafafa' }}>
                    <Button 
                        onClick={handleCloseDialog} 
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleReviewAction} 
                        variant="contained" 
                        color="primary"
                        sx={{ borderRadius: '8px', textTransform: 'none' }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default TeacherExams;
