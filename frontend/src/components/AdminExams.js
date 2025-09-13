import React, { useState, useEffect, useCallback } from 'react';
import {
    Typography, Container, Box, Grid, Card, CardContent, 
    CircularProgress, Snackbar, Alert, Divider, Table, 
    TableBody, TableCell, TableContainer, TableHead, 
    TableRow, Paper, IconButton, Chip, Dialog,
    DialogActions, DialogContent, DialogContentText,
    DialogTitle, Button
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { format } from 'date-fns';

const AdminExams = ({ session }) => {
    
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, examId: null, examName: '' });
    const [detailsDialog, setDetailsDialog] = useState({ open: false, exam: null });

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const fetchExams = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/exams', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch exams');
            }
            
            const data = await response.json();
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

    const handleOpenDeleteDialog = (examId, examName) => {
        setDeleteDialog({ open: true, examId, examName });
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialog({ open: false, examId: null, examName: '' });
    };

    const handleDeleteExam = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${deleteDialog.examId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete exam');
            }
            
            setSnackbar({ open: true, message: 'Exam deleted successfully', severity: 'success' });
            fetchExams(); // Refresh the exams list
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            handleCloseDeleteDialog();
        }
    };

    const handleOpenDetailsDialog = (exam) => {
        setDetailsDialog({ open: true, exam });
    };

    const handleCloseDetailsDialog = () => {
        setDetailsDialog({ open: false, exam: null });
    };

    const getStatusChipColor = (status) => {
        switch (status) {
            case 'PROPUSA': return 'primary';
            case 'APROBATA': return 'success';
            case 'RESPINSA': return 'error';
            case 'PROPOSTA': return 'warning';
            case 'CONFIRMATA': return 'success';
            default: return 'default';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
        } catch (error) {
            return 'Invalid Date';
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" gutterBottom>
                                Exam Management
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                View and manage all exams in the system
                            </Typography>
                        </CardContent>
                        <Divider />
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                                <Table stickyHeader aria-label="exams table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Discipline</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Group</TableCell>
                                            <TableCell>Room</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {exams.length > 0 ? (
                                            exams.map((exam) => (
                                                <TableRow key={exam.exam_id} hover>
                                                    <TableCell>{exam.discipline_name}</TableCell>
                                                    <TableCell>{formatDate(exam.exam_date)}</TableCell>
                                                    <TableCell>{exam.group_name || 'N/A'}</TableCell>
                                                    <TableCell>{exam.room_name || 'Not assigned'}</TableCell>
                                                    <TableCell>
                                                        <Chip 
                                                            label={exam.status} 
                                                            color={getStatusChipColor(exam.status)} 
                                                            size="small" 
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton 
                                                            onClick={() => handleOpenDetailsDialog(exam)} 
                                                            size="small" 
                                                            color="primary"
                                                        >
                                                            <InfoIcon />
                                                        </IconButton>
                                                        <IconButton 
                                                            onClick={() => handleOpenDeleteDialog(exam.exam_id, exam.discipline_name)} 
                                                            size="small" 
                                                            color="error"
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">
                                                    No exams found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Card>
                </Grid>
            </Grid>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialog.open}
                onClose={handleCloseDeleteDialog}
            >
                <DialogTitle>Delete Exam</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the exam for <strong>{deleteDialog.examName}</strong>? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
                    <Button onClick={handleDeleteExam} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Exam Details Dialog */}
            <Dialog
                open={detailsDialog.open}
                onClose={handleCloseDetailsDialog}
                maxWidth="md"
                fullWidth
            >
                {detailsDialog.exam && (
                    <>
                        <DialogTitle>Exam Details: {detailsDialog.exam.discipline_name}</DialogTitle>
                        <DialogContent>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2">Discipline:</Typography>
                                    <Typography variant="body1" gutterBottom>{detailsDialog.exam.discipline_name}</Typography>
                                    
                                    <Typography variant="subtitle2">Date:</Typography>
                                    <Typography variant="body1" gutterBottom>{formatDate(detailsDialog.exam.exam_date)}</Typography>
                                    
                                    <Typography variant="subtitle2">Status:</Typography>
                                    <Chip 
                                        label={detailsDialog.exam.status} 
                                        color={getStatusChipColor(detailsDialog.exam.status)} 
                                        size="small" 
                                        sx={{ mt: 0.5, mb: 1 }}
                                    />
                                    
                                    <Typography variant="subtitle2">Duration:</Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {detailsDialog.exam.duration ? `${detailsDialog.exam.duration} minutes` : 'Not specified'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="subtitle2">Year of Study:</Typography>
                                    <Typography variant="body1" gutterBottom>{detailsDialog.exam.year_of_study || 'N/A'}</Typography>
                                    
                                    <Typography variant="subtitle2">Specialization:</Typography>
                                    <Typography variant="body1" gutterBottom>{detailsDialog.exam.specialization || 'N/A'}</Typography>
                                    
                                    <Typography variant="subtitle2">Group:</Typography>
                                    <Typography variant="body1" gutterBottom>{detailsDialog.exam.group_name || 'N/A'}</Typography>
                                    
                                    <Typography variant="subtitle2">Room:</Typography>
                                    <Typography variant="body1" gutterBottom>
                                        {detailsDialog.exam.room_name ? 
                                            `${detailsDialog.exam.room_name} (Capacity: ${detailsDialog.exam.room_capacity || 'N/A'})` : 
                                            'Not assigned'}
                                    </Typography>
                                </Grid>
                            </Grid>

                            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Teachers</Typography>
                            <Divider sx={{ mb: 2 }} />
                            
                            {detailsDialog.exam.teachers && detailsDialog.exam.teachers.length > 0 ? (
                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Email</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {detailsDialog.exam.teachers.map((teacher) => (
                                                <TableRow key={teacher.teacher_id}>
                                                    <TableCell>{teacher.teacher_name}</TableCell>
                                                    <TableCell>{teacher.teacher_email}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    No teachers assigned to this exam
                                </Typography>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleCloseDetailsDialog}>Close</Button>
                            <Button 
                                onClick={() => {
                                    handleCloseDetailsDialog();
                                    handleOpenDeleteDialog(detailsDialog.exam.exam_id, detailsDialog.exam.discipline_name);
                                }} 
                                color="error"
                            >
                                Delete Exam
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default AdminExams;
