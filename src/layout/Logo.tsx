import { Box, Typography } from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';

const Logo = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StorefrontOutlinedIcon aria-hidden />
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>Shop Admin</Typography>
    </Box>
);
export default Logo;
