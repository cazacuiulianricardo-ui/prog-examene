import React, { useState } from 'react';
import { 
    Button, TextField, Typography, Box, CircularProgress, 
    InputAdornment, IconButton, CssBaseline
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { supabase } from '../supabaseClient'; // Import supabase client

// Styled components
const LoginContainer = styled(Box)(({ theme }) => ({
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    position: 'relative'
}));

const LeftPanel = styled(Box)(({ theme }) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(6),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url(https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2000)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.2,
    }
}));

const RightPanel = styled(Box)(({ theme }) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: theme.spacing(6),
    backgroundColor: theme.palette.background.default
}));

const GoogleButton = styled(Button)(({ theme }) => ({
    backgroundColor: '#fff',
    color: '#757575',
    border: '1px solid #ddd',
    borderRadius: '30px',
    padding: '12px 24px',
    textTransform: 'none',
    fontWeight: 500,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    '&:hover': {
        backgroundColor: '#f5f5f5',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    }
}));

const AdminButton = styled(Button)(({ theme }) => ({
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderRadius: '30px',
    padding: '12px 24px',
    textTransform: 'none',
    fontWeight: 500,
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
        boxShadow: '0 6px 12px rgba(0,0,0,0.2)'
    }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    '& .MuiOutlinedInput-root': {
        borderRadius: '30px',
        '& fieldset': {
            borderColor: 'rgba(0, 0, 0, 0.23)',
        },
        '&:hover fieldset': {
            borderColor: theme.palette.primary.main,
        },
        '&.Mui-focused fieldset': {
            borderColor: theme.palette.primary.main,
        },
    },
    '& .MuiInputBase-input': {
        padding: '14px 20px',
    },
    '& .MuiInputAdornment-root': {
        marginRight: '12px',
    }
}));

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [activePanel, setActivePanel] = useState('google'); // 'google' or 'admin'

    const handleGoogleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({ 
            provider: 'google' 
        });
        if (error) {
            alert(error.message);
        }
        setLoading(false);
    };

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                window.location.href = '/'; // Redirect to trigger App.js session check
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred during login.');
        }
        setLoading(false);
    };

    const handleTogglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const togglePanel = (panel) => {
        setActivePanel(panel);
    };

    return (
        <>
            <CssBaseline />
            <LoginContainer>
                {/* Left Panel - Hero Section */}
                <LeftPanel>
                    <Box sx={{ position: 'relative', zIndex: 1, maxWidth: '500px', textAlign: 'center' }}>
                        <Typography variant="h2" component="h1" fontWeight="700" gutterBottom>
                            FIESC programare examene
                        </Typography>
                        <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
                            Programarea examenelor pentru profesori, studenti, șefi de grupă și personalul secretariatului
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 4 }}>
                            <Button 
                                variant={activePanel === 'google' ? "contained" : "outlined"} 
                                onClick={() => togglePanel('google')} 
                                sx={{ 
                                    borderRadius: '30px', 
                                    color: activePanel === 'google' ? 'white' : 'white',
                                    borderColor: 'white',
                                    '&:hover': { borderColor: 'white', bgcolor: activePanel === 'google' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }
                                }}
                            >
                                Studenți & Profesori
                            </Button>
                            <Button 
                                variant={activePanel === 'admin' ? "contained" : "outlined"} 
                                onClick={() => togglePanel('admin')}
                                sx={{ 
                                    borderRadius: '30px', 
                                    color: activePanel === 'admin' ? 'white' : 'white',
                                    borderColor: 'white',
                                    '&:hover': { borderColor: 'white', bgcolor: activePanel === 'admin' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }
                                }}
                            >
                                Administrator
                            </Button>
                        </Box>
                    </Box>
                </LeftPanel>

                {/* Right Panel - Login Forms */}
                <RightPanel>
                    <Box sx={{ maxWidth: '400px', width: '100%', mx: 'auto' }}>
                        {activePanel === 'google' ? (
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" component="h2" fontWeight="600" gutterBottom>
                                    Bine ai venit!
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                                    Autentifică-te cu contul Google instituțional
                                </Typography>
                                
                                <GoogleButton
                                    fullWidth
                                    variant="outlined"
                                    size="large"
                                    startIcon={<GoogleIcon />}
                                    onClick={handleGoogleLogin}
                                    disabled={loading}
                                >
                                    {loading ? <CircularProgress size={20} /> : 'Autentifică-te cu Google'}
                                </GoogleButton>
                                
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                                    Pentru studenți, șefi de grupă, profesori și personalul secretariatului
                                </Typography>
                            </Box>
                        ) : (
                            <Box>
                                <Typography variant="h4" component="h2" fontWeight="600" gutterBottom>
                                    Administrator Login
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                                    Autentifică-te pentru a accesa panoul de administrare
                                </Typography>
                                
                                <Box component="form" onSubmit={handleAdminLogin}>
                                    <StyledTextField
                                        required
                                        fullWidth
                                        id="username"
                                        placeholder="Username"
                                        name="username"
                                        autoComplete="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <PersonOutlineIcon color="primary" />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <StyledTextField
                                        required
                                        fullWidth
                                        name="password"
                                        placeholder="Password"
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockOutlinedIcon color="primary" />
                                                </InputAdornment>
                                            ),
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle password visibility"
                                                        onClick={handleTogglePasswordVisibility}
                                                        edge="end"
                                                    >
                                                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                    <AdminButton
                                        type="submit"
                                        fullWidth
                                        disabled={loading}
                                        sx={{ mt: 2 }}
                                    >
                                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                                    </AdminButton>
                                </Box>
                            </Box>
                        )}
                        
                        <Box sx={{ textAlign: 'center', mt: 6 }}>
                            <Typography variant="body2" color="text.secondary">
                                © {new Date().getFullYear()} FIESC Sistem de programare a examenilor
                            </Typography>
                        </Box>
                    </Box>
                </RightPanel>
            </LoginContainer>
        </>
    );
};

export default Login;
