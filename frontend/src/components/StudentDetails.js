import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, CircularProgress, Snackbar, Alert } from '@mui/material';

const StudentDetails = ({ session, userDetails, onUpdate }) => {
    const [studentGroup, setStudentGroup] = useState('');
    const [yearOfStudy, setYearOfStudy] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (userDetails) {
            setStudentGroup(userDetails.student_group || '');
            setYearOfStudy(userDetails.year_of_study || '');
        }
    }, [userDetails]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        const year = parseInt(yearOfStudy, 10);
        if (yearOfStudy && (isNaN(year) || year < 1 || year > 6)) {
            setError('Anul de studiu trebuie să fie un număr între 1 și 6.');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/user/details', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    student_group: studentGroup,
                    year_of_study: yearOfStudy ? year : null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update details.');
            }

            setSuccess('Detalii actualizate cu succes!');
            onUpdate(data.user); // Callback to update parent state
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
                Detalii academice
            </Typography>
            <Box component="form" onSubmit={handleSubmit} noValidate>
                <TextField
                    margin="normal"
                    fullWidth
                    id="studentGroup"
                    label="Your Group"
                    name="studentGroup"
                    value={studentGroup}
                    onChange={(e) => setStudentGroup(e.target.value)}
                    helperText="e.g., 3132a"
                />
                <TextField
                    margin="normal"
                    fullWidth
                    id="yearOfStudy"
                    label="Year of Study"
                    name="yearOfStudy"
                    type="number"
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                    InputProps={{ inputProps: { min: 1, max: 6 } }}
                    helperText="e.g., 3"
                />
                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={{ mt: 3, mb: 2 }}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Save Details'}
                </Button>
            </Box>
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
                <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
            <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
                <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
                    {success}
                </Alert>
            </Snackbar>
        </Paper>
    );
};

export default StudentDetails;
