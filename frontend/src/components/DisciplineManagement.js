import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    TextField,
    Typography,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Chip,
    OutlinedInput,
    Card,
    CardContent,
    CardHeader,
    Grid,
    Divider,
    Tooltip,
    Snackbar,
    Avatar,
    Container
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};

const DisciplineManagement = () => {
    const [disciplines, setDisciplines] = useState([]);
    const [allTeachers, setAllTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editState, setEditState] = useState({});
    const [newDisciplineName, setNewDisciplineName] = useState('');
    const [newDisciplineTeachers, setNewDisciplineTeachers] = useState([]);
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

    const adminToken = localStorage.getItem('admin_token');

    const fetchDisciplines = useCallback(async () => {
        try {
            const response = await fetch('/api/disciplines', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            if (!response.ok) throw new Error('Failed to fetch disciplines');
            const data = await response.json();
            setDisciplines(data);
        } catch (err) {
            setError(err.message);
        }
    }, [adminToken]);

    const fetchTeachers = useCallback(async () => {
        try {
            const response = await fetch('/api/teachers', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            if (!response.ok) throw new Error('Failed to fetch teachers');
            const data = await response.json();
            setAllTeachers(data);
        } catch (err) {
            setError(err.message);
        }
    }, [adminToken]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchDisciplines(), fetchTeachers()])
            .finally(() => setLoading(false));
    }, [fetchDisciplines, fetchTeachers]);

    const handleAddDiscipline = async () => {
        if (!newDisciplineName) {
            setError('Discipline name cannot be empty.');
            return;
        }
        try {
            const response = await fetch('/api/disciplines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ name: newDisciplineName, teacher_ids: newDisciplineTeachers })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to add discipline');
            setSuccess('Discipline added successfully!');
            setNewDisciplineName('');
            setNewDisciplineTeachers([]);
            fetchDisciplines();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            const response = await fetch(`/api/disciplines/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to delete discipline');
            setSuccess('Discipline deleted successfully!');
            fetchDisciplines();
        } catch (err) {
            setError(err.message);
        }
        setDeleteConfirm({ open: false, id: null });
    };

    const handleUpdate = async (id) => {
        const { name, teacher_ids } = editState[id];
        if (!name) {
            setError('Discipline name cannot be empty.');
            return;
        }
        try {
            const response = await fetch(`/api/disciplines/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`
                },
                body: JSON.stringify({ name, teacher_ids: teacher_ids || [] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to update discipline');
            setSuccess('Discipline updated successfully!');
            setEditState(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
            fetchDisciplines();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEditClick = (discipline) => {
        setEditState(prev => ({
            ...prev,
            [discipline.id]: {
                name: discipline.name,
                teacher_ids: discipline.teachers ? discipline.teachers.map(t => t.id) : []
            }
        }));
    };

    const handleCancelClick = (id) => {
        setEditState(prev => { const newState = { ...prev }; delete newState[id]; return newState; });
    };

    const handleInputChange = (e, id) => {
        const { name, value } = e.target;
        setEditState(prev => ({
            ...prev,
            [id]: { ...prev[id], [name]: value }
        }));
    };

    const handleTeacherChange = (e, id) => {
        const { target: { value } } = e;
        setEditState(prev => ({
            ...prev,
            [id]: { ...prev[id], teacher_ids: typeof value === 'string' ? value.split(',') : value }
        }));
    };

    const handleNewTeacherChange = (event) => {
        const { target: { value } } = event;
        setNewDisciplineTeachers(
            typeof value === 'string' ? value.split(',') : value,
        );
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <CircularProgress size={60} thickness={4} />
        </Box>
    );

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 3 }}>
                    <CardHeader 
                        title={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <SchoolIcon fontSize="large" color="primary" />
                                <Typography variant="h4">Panou discipline</Typography>
                            </Box>
                        }
                        sx={{ bgcolor: 'primary.light', color: 'white', pb: 1 }}
                    />
                    <CardContent>
                        <Typography variant="body1" color="text.secondary" paragraph>
                        Gestionează disciplinele academice și atribuie profesori. Adaugă discipline noi, editează-le pe cele existente sau elimină disciplinele dorite.
                        </Typography>
                    </CardContent>
                </Card>

                <Snackbar 
                    open={!!error} 
                    autoHideDuration={6000} 
                    onClose={() => setError('')}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%' }}>{error}</Alert>
                </Snackbar>

                <Snackbar 
                    open={!!success} 
                    autoHideDuration={6000} 
                    onClose={() => setSuccess('')}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                >
                    <Alert severity="success" onClose={() => setSuccess('')} sx={{ width: '100%' }}>{success}</Alert>
                </Snackbar>

                <Card sx={{ mb: 4, borderRadius: 2, boxShadow: 2 }}>
                    <CardHeader 
                        title={
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <AddCircleIcon sx={{ mr: 1 }} />
                                <Typography variant="h6">Adaugare disciplină</Typography>
                            </Box>
                        }
                        sx={{ bgcolor: 'background.paper', pb: 0 }}
                    />
                    <CardContent>
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Nume disciplină"
                                    value={newDisciplineName}
                                    onChange={(e) => setNewDisciplineName(e.target.value)}
                                    variant="outlined"
                                    fullWidth
                                    placeholder="Enter discipline name"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Atribuie profesori</InputLabel>
                                    <Select
                                        multiple
                                        value={newDisciplineTeachers}
                                        onChange={handleNewTeacherChange}
                                        input={<OutlinedInput label="Assign Teachers" />}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip 
                                                        key={value} 
                                                        label={allTeachers.find(t => t.id === value)?.full_name || ''}
                                                        avatar={<Avatar><PersonIcon /></Avatar>}
                                                        color="primary"
                                                        variant="outlined"
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                        MenuProps={MenuProps}
                                    >
                                        {allTeachers.map(teacher => (
                                            <MenuItem key={teacher.id} value={teacher.id}>
                                                {teacher.full_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <Button 
                                    variant="contained" 
                                    color="primary" 
                                    onClick={handleAddDiscipline}
                                    fullWidth
                                    size="large"
                                    startIcon={<AddCircleIcon />}
                                    sx={{ py: 1.5 }}
                                >
                                    Adăugare
                                </Button>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
                    <CardHeader 
                        title={
                            <Typography variant="h6">Listă discipline</Typography>
                        }
                        sx={{ bgcolor: 'background.paper', pb: 0 }}
                    />
                    <Divider />
                    <CardContent sx={{ p: 0 }}>
                        <TableContainer>
                            <Table sx={{ minWidth: 650 }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Nume disciplină</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Profesori</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Acțiuni</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {disciplines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                                <Typography variant="body1" color="text.secondary">
                                                    No disciplines found. Add your first discipline above.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        disciplines.map((d) => (
                                            <TableRow key={d.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                {
                                                    editState[d.id] ? (
                                                        <>
                                                            <TableCell sx={{ width: '30%' }}>
                                                                <TextField
                                                                    value={editState[d.id].name}
                                                                    onChange={(e) => handleInputChange(e, d.id)}
                                                                    name="name"
                                                                    fullWidth
                                                                    variant="outlined"
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ width: '50%' }}>
                                                                <FormControl fullWidth size="small">
                                                                    <InputLabel>Profesori</InputLabel>
                                                                    <Select
                                                                        multiple
                                                                        value={editState[d.id].teacher_ids || []}
                                                                        onChange={(e) => handleTeacherChange(e, d.id)}
                                                                        input={<OutlinedInput label="Profesori" />}
                                                                        renderValue={(selected) => (
                                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                                {selected.map((value) => (
                                                                                    <Chip 
                                                                                        key={value} 
                                                                                        label={allTeachers.find(t => t.id === value)?.full_name || ''}
                                                                                        size="small"
                                                                                        color="primary"
                                                                                        variant="outlined"
                                                                                    />
                                                                                ))}
                                                                            </Box>
                                                                        )}
                                                                        MenuProps={MenuProps}
                                                                    >
                                                                        {allTeachers.map(teacher => (
                                                                            <MenuItem key={teacher.id} value={teacher.id}>
                                                                                {teacher.full_name}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Tooltip title="Save">
                                                                    <IconButton onClick={() => handleUpdate(d.id)} color="primary">
                                                                        <SaveIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Cancel">
                                                                    <IconButton onClick={() => handleCancelClick(d.id)}>
                                                                        <CancelIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </TableCell>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <TableCell>
                                                                <Typography variant="body1">{d.name}</Typography>
                                                            </TableCell>
                                                            <TableCell>
                                                                {d.teachers && d.teachers.length > 0 ? (
                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                        {d.teachers.map(teacher => (
                                                                            <Chip 
                                                                                key={teacher.id}
                                                                                label={teacher.full_name}
                                                                                size="small"
                                                                                variant="outlined"
                                                                                icon={<PersonIcon fontSize="small" />}
                                                                            />
                                                                        ))}
                                                                    </Box>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">No teachers assigned</Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Tooltip title="Edit">
                                                                    <IconButton onClick={() => handleEditClick(d)} color="primary" size="small">
                                                                        <EditIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Delete">
                                                                    <IconButton onClick={() => setDeleteConfirm({ open: true, id: d.id })} color="error" size="small">
                                                                        <DeleteIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </TableCell>
                                                        </>
                                                    )
                                                }
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>

                <Dialog
                    open={deleteConfirm.open}
                    onClose={() => setDeleteConfirm({ open: false, id: null })}
                    PaperProps={{
                        sx: { borderRadius: 2 }
                    }}
                >
                    <DialogTitle sx={{ bgcolor: 'error.light', color: 'white' }}>
                        Confirm Deletion
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2, pb: 3, px: 3, mt: 1 }}>
                        <DialogContentText>
                            Are you sure you want to delete this discipline? This action cannot be undone and may affect related exams and schedules.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button 
                            onClick={() => setDeleteConfirm({ open: false, id: null })} 
                            variant="outlined"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={() => handleDelete(deleteConfirm.id)} 
                            color="error" 
                            variant="contained"
                            startIcon={<DeleteIcon />}
                        >
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Container>
    );
};

export default DisciplineManagement;
