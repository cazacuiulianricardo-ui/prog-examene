import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, TextField, Box, Typography, Alert, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, IconButton, Stack
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const RoomManagement = () => {
    const [rooms, setRooms] = useState([]);
    const [editingRoomId, setEditingRoomId] = useState(null);
    const [editedRoom, setEditedRoom] = useState({});
    const [newRoom, setNewRoom] = useState({ name: '', short_name: '', building_name: '', capacity: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);

    const apiHeaders = useMemo(() => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
    }), []);

    const fetchRooms = useCallback(() => {
        fetch('http://localhost:5000/api/rooms', { headers: apiHeaders })
            .then(res => {
                if (!res.ok) {
                    throw new Error('Failed to fetch rooms');
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setRooms(data);
                } else {
                    console.error('Received data is not an array:', data);
                    setRooms([]); // Prevent crash
                }
            })
            .catch(err => {
                console.error("Error fetching rooms:", err)
                setRooms([]); // Prevent crash on error
            });
    }, [apiHeaders]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const handleEditClick = (room) => {
        setEditingRoomId(room.id);
        setEditedRoom({ ...room });
    };

    const handleCancelClick = () => {
        setEditingRoomId(null);
        setEditedRoom({});
    };

    const handleSaveClick = (roomId) => {
        setError('');
        setSuccess('');
        fetch(`http://localhost:5000/api/rooms/${roomId}`, {
            method: 'PUT',
            headers: apiHeaders,
            body: JSON.stringify(editedRoom)
        })
        .then(res => {
            if (res.ok) {
                setSuccess('Room updated successfully!');
                setEditingRoomId(null);
                fetchRooms();
            } else {
                setError('Failed to update room.');
            }
        })
        .catch(err => setError(`Error updating room: ${err.message}`));
    };

    const handleDeleteClick = (roomId) => {
        setRoomToDelete(roomId);
        setOpenDeleteDialog(true);
    };

    const confirmDelete = () => {
        if (!roomToDelete) return;
        setError('');
        setSuccess('');
        fetch(`http://localhost:5000/api/rooms/${roomToDelete}`, {
            method: 'DELETE',
            headers: apiHeaders
        })
        .then(res => {
            if (res.ok) {
                setSuccess('Room deleted successfully!');
                fetchRooms();
            } else {
                setError('Failed to delete room.');
            }
        })
        .catch(err => setError(`Error deleting room: ${err.message}`))
        .finally(() => {
            setOpenDeleteDialog(false);
            setRoomToDelete(null);
        });
    };

    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
        setRoomToDelete(null);
    };

    const handleInputChange = (e, isEdit = true) => {
        const { name, value } = e.target;
        if (isEdit) {
            setEditedRoom(prev => ({ ...prev, [name]: value }));
        } else {
            setNewRoom(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddRoom = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        fetch('http://localhost:5000/api/rooms', {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify(newRoom)
        })
        .then(res => {
            if (res.ok) {
                setSuccess('Room added successfully!');
                setNewRoom({ name: '', short_name: '', building_name: '', capacity: '' });
                fetchRooms();
            } else {
                setError('Failed to add room.');
            }
        })
        .catch(err => setError(`Error adding room: ${err.message}`));
    };

    return (
        <Box>
            <Typography variant="h5" component="h2" gutterBottom>
                    Panou săli
            </Typography>

            {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

            <Paper component="form" onSubmit={handleAddRoom} sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6">Adaugare Sali</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                    <TextField label="Nume sală" name="name" value={newRoom.name} onChange={(e) => handleInputChange(e, false)} required variant="outlined" size="small" sx={{ flex: '1 1 150px' }} />
                    <TextField label="Prescurtare sală" name="short_name" value={newRoom.short_name} onChange={(e) => handleInputChange(e, false)} variant="outlined" size="small" sx={{ flex: '1 1 100px' }} />
                    <TextField label="Clădire" name="building_name" value={newRoom.building_name} onChange={(e) => handleInputChange(e, false)} variant="outlined" size="small" sx={{ flex: '1 1 100px' }} />
                    <TextField label="Capacitate" name="capacity" type="number" value={newRoom.capacity} onChange={(e) => handleInputChange(e, false)} required variant="outlined" size="small" sx={{ flex: '1 1 80px' }} />
                    <Button type="submit" variant="contained">Adăugare</Button>
                </Box>
            </Paper>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Nume</TableCell>
                            <TableCell>Prescurtare sală</TableCell>
                            <TableCell>Clădire</TableCell>
                            <TableCell>Capacitate</TableCell>
                            <TableCell align="right">Acțiuni</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rooms.map(room => (
                            <TableRow key={room.id}>
                                {editingRoomId === room.id ? (
                                    <>
                                        <TableCell><TextField variant="standard" name="name" value={editedRoom.name} onChange={handleInputChange} /></TableCell>
                                        <TableCell><TextField variant="standard" name="short_name" value={editedRoom.short_name} onChange={handleInputChange} /></TableCell>
                                        <TableCell><TextField variant="standard" name="building_name" value={editedRoom.building_name} onChange={handleInputChange} /></TableCell>
                                        <TableCell><TextField variant="standard" type="number" name="capacity" value={editedRoom.capacity} onChange={handleInputChange} /></TableCell>
                                        <TableCell align="right">
                                            <Button variant="contained" onClick={() => handleSaveClick(room.id)} sx={{ mr: 1 }}>Save</Button>
                                            <Button variant="outlined" onClick={handleCancelClick}>Cancel</Button>
                                        </TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell>{room.name}</TableCell>
                                        <TableCell>{room.short_name}</TableCell>
                                        <TableCell>{room.building_name}</TableCell>
                                        <TableCell>{room.capacity}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <IconButton onClick={() => handleEditClick(room)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton onClick={() => handleDeleteClick(room.id)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Stack>
                                        </TableCell>
                                    </>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this room? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
                    <Button onClick={confirmDelete} color="error">Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RoomManagement;
