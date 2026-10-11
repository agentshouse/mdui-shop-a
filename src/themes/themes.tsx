import {
    RaThemeOptions,
    defaultLightTheme,
    defaultDarkTheme,
    nanoDarkTheme,
    nanoLightTheme,
    radiantDarkTheme,
    radiantLightTheme,
    houseDarkTheme,
    houseLightTheme,
    bwLightTheme,
    bwDarkTheme,
} from 'react-admin';

import { softDarkTheme, softLightTheme } from './softTheme';
import { chiptuneTheme } from './chiptuneTheme';
import { cssVariablesTheme } from './cssVariablesTheme';

export type ThemeName =
    | 'soft'
    | 'B&W'
    | 'default'
    | 'nano'
    | 'radiant'
    | 'house'
    | 'chiptune'
    | 'cssVariables';

export type Theme = {
    name: ThemeName;
    light?: RaThemeOptions;
    dark?: RaThemeOptions;
    single?: RaThemeOptions;
};

const BW_SIDEBAR_OVERRIDE = {
    styleOverrides: {
        root: {
            '& .SubMenu .MuiMenuItem-root': {
                paddingLeft: 24,
            },
            '& .RaMenu-closed .SubMenu .MuiMenuItem-root': {
                paddingLeft: 8,
            },
        },
    },
};

const donorThemes: Theme[] = [
    { name: 'soft', light: softLightTheme, dark: softDarkTheme },
    {
        name: 'cssVariables',
        single: cssVariablesTheme,
    },
    { name: 'default', light: defaultLightTheme, dark: defaultDarkTheme },
    {
        name: 'B&W',
        light: {
            ...bwLightTheme,
            components: {
                ...bwLightTheme.components,
                RaSidebar: BW_SIDEBAR_OVERRIDE,
            },
        },
        dark: {
            ...bwDarkTheme,
            components: {
                ...bwDarkTheme.components,
                RaSidebar: BW_SIDEBAR_OVERRIDE,
            },
        },
    },
    { name: 'nano', light: nanoLightTheme, dark: nanoDarkTheme },
    { name: 'radiant', light: radiantLightTheme, dark: radiantDarkTheme },
    { name: 'house', light: houseLightTheme, dark: houseDarkTheme },
    { name: 'chiptune', single: chiptuneTheme },
];

const localTheme = (theme: RaThemeOptions | undefined, name: ThemeName): RaThemeOptions | undefined => theme ? ({
    ...theme,
    typography: { ...theme.typography, fontFamily: name === 'chiptune' ? 'monospace' : name === 'radiant' ? 'Quicksand, sans-serif' : 'Roboto, Arial, sans-serif' },
    components: {
        ...theme.components,
        RaDeleteButton: { ...theme.components?.RaDeleteButton, defaultProps: { ...theme.components?.RaDeleteButton?.defaultProps, mutationMode: 'pessimistic' } },
        RaBulkDeleteButton: { ...theme.components?.RaBulkDeleteButton, defaultProps: { ...theme.components?.RaBulkDeleteButton?.defaultProps, mutationMode: 'pessimistic' } },
    },
}) : undefined;
export const themes: Theme[] = donorThemes.map(theme => ({ ...theme, single: localTheme(theme.single, theme.name), light: localTheme(theme.light, theme.name), dark: localTheme(theme.dark, theme.name) }));
