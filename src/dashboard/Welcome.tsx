import { Box, Card, CardActions, Button, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { Link } from 'react-router-dom';
import { useTranslate } from 'react-admin';
import publishArticleImage from './welcome_illustration.svg';

const Welcome = () => {
    const translate = useTranslate();
    return (
        <Card sx={{ background: theme => `linear-gradient(45deg, ${theme.palette.secondary.dark} 0%, ${theme.palette.secondary.light} 50%, ${theme.palette.primary.dark} 100%)`, color: theme => theme.palette.primary.contrastText, padding: '20px', marginTop: 2, marginBottom: '1em' }}>
            <Box sx={{ display: 'flex' }}>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" component="h2" gutterBottom>{translate('pos.dashboard.welcome.title')}</Typography>
                    <Typography variant="body1" component="p" gutterBottom sx={{ maxWidth: '40em' }}>{translate('pos.dashboard.welcome.subtitle')}</Typography>
                    <CardActions sx={{ p: 0, pt: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Button variant="contained" component={Link} to="/products" startIcon={<Inventory2OutlinedIcon />}>{translate('resources.products.name', { smart_count: 2 })}</Button>
                        <Button variant="contained" component={Link} to="/orders" startIcon={<ShoppingCartOutlinedIcon />}>{translate('resources.orders.name', { smart_count: 2 })}</Button>
                    </CardActions>
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' }, width: '16em', height: '9em', overflow: 'hidden', background: `url(${publishArticleImage}) top right / cover`, marginLeft: 'auto' }} />
            </Box>
        </Card>
    );
};
export default Welcome;
