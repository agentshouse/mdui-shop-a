import type { Theme } from '@mui/material/styles';

// MUI's image fallback uses background.default as its foreground. For initials,
// select readable text against its unchanged gray avatar background instead.
export const initialsAvatarSx = (theme: Theme) => ({
    color: theme.palette.getContrastText(theme.palette.grey[400]),
    ...theme.applyStyles('dark', {
        color: theme.palette.getContrastText(theme.palette.grey[600]),
    }),
});
