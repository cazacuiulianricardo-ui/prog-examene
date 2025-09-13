import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
    AppBar, Toolbar, Typography, Button, Container, Box, Grid, Card,
    CardContent, CardActions, Divider, Snackbar, Alert, Stack, ButtonGroup
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExamAssignment from './ExamAssignment';

const SecDashboard = ({ session }) => {
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [approvedExams, setApprovedExams] = useState([]);
    const [loadingExams, setLoadingExams] = useState(true);
    const [downloading, setDownloading] = useState({ excel: false, pdf: false });

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleCloseSnackbar = () => {
        setSnackbar({ ...snackbar, open: false });
    };

    const fetchApprovedExams = useCallback(async () => {
        try {
            setLoadingExams(true);
            const response = await fetch('/api/sec/approved-exams', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Eroare la descarcare examene confirmate.');
            const data = await response.json();
            setApprovedExams(data);
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setLoadingExams(false);
        }
    }, [session.access_token]);

    useEffect(() => {
        fetchApprovedExams();
    }, [fetchApprovedExams]);

    const handleDownloadExcel = async () => {
        try {
            setDownloading(prev => ({ ...prev, excel: true }));
            const response = await fetch('/api/sec/exams/export', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Eroare la descarcare Excel.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `exam_schedule_${date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setSnackbar({ open: true, message: 'Excel descărcat cu succes!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setDownloading(prev => ({ ...prev, excel: false }));
        }
    };

    const handleDownloadPdf = async () => {
        try {
            setDownloading(prev => ({ ...prev, pdf: true }));
            const response = await fetch('/api/sec/exams/export-pdf', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Eroare la descarcare PDF.');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `exam_schedule_${date}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setSnackbar({ open: true, message: 'PDF descarcat cu succes!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: error.message, severity: 'error' });
        } finally {
            setDownloading(prev => ({ ...prev, pdf: false }));
        }
    };

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Meniu secretariat
                    </Typography>
                    <Typography variant="body2" sx={{ mr: 2 }}>
                        {session.user.email}
                    </Typography>
                    <Button color="inherit" onClick={handleLogout}>Logout</Button>
                </Toolbar>
            </AppBar>

            <Container sx={{ mt: 4 }}>
                <Grid container spacing={3}>
                    {/* Exam Assignment Form */}
                    <Grid item xs={12}>
                        <ExamAssignment session={session} />
                    </Grid>

                    {/* Export Exams Card */}
                    <Grid item xs={12}>
                        <Card sx={{ borderRadius: 2, boxShadow: 3 }}>
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={2}>
                                    <CloudDownloadIcon fontSize="large" color="primary" />
                                    <Typography variant="h5" component="div">Exportează examenele confirmate</Typography>
                                </Stack>
                                <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 2 }}>
                                    Descarcă lista completă cu toate examenele confirmate în formatul Excel sau. Fișierul include detalii precum numele disciplinei, tipul examenului, grupa, data examenului, ora, sala și profesorii.
                                </Typography>
                            </CardContent>
                            <Divider />
                            <CardActions sx={{ p: 2, justifyContent: 'center' }}>
                                <ButtonGroup variant="contained" size="large" aria-label="download options">
                                    <Button
                                        color="primary"
                                        startIcon={<DownloadIcon />}
                                        onClick={handleDownloadExcel}
                                        disabled={loadingExams || approvedExams.length === 0 || downloading.excel || downloading.pdf}
                                        sx={{ px: 3, py: 1 }}
                                    >
                                        {downloading.excel ? 'Descarcare...' : `Excel (${approvedExams.length} examene)`}
                                    </Button>
                                    <Button
                                        color="secondary"
                                        startIcon={<PictureAsPdfIcon />}
                                        onClick={handleDownloadPdf}
                                        disabled={loadingExams || approvedExams.length === 0 || downloading.excel || downloading.pdf}
                                        sx={{ px: 3, py: 1 }}
                                    >
                                        {downloading.pdf ? 'Descarcare...' : `PDF (${approvedExams.length} examene)`}
                                    </Button>
                                </ButtonGroup>
                            </CardActions>
                        </Card>
                    </Grid>
                </Grid>
            </Container>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SecDashboard;
