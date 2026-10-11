import { useMemo } from 'react';
import polyglotI18nProvider from 'ra-i18n-polyglot';
import {
    Admin, CustomRoutes, Resource, memoryStore, useStore,
    StoreContextProvider, type DataProvider,
} from 'react-admin';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import categories from './categories';
import { Dashboard } from './dashboard';
import englishMessages from './i18n/en';
import frenchMessages from './i18n/fr';
import invoices from './invoices';
import { Layout } from './layout';
import orders from './orders';
import products from './products';
import reviews from './reviews';
import Segments from './segments/Segments';
import visitors from './visitors';
import { themes, ThemeName } from './themes/themes';

const i18nProvider = polyglotI18nProvider(
    locale => locale === 'fr'
        ? frenchMessages
        : englishMessages,
    'en',
    [{ locale: 'en', name: 'English' }, { locale: 'fr', name: 'Français' }],
);

type AppProps = { dataProvider: DataProvider; queryClient: QueryClient };
type Store = ReturnType<typeof memoryStore>;
const App = ({ dataProvider, queryClient, store }: AppProps & { store: Store }) => {
    const [themeName] = useStore<ThemeName>('themeName', 'soft');
    const selected = themes.find(theme => theme.name === themeName) ?? themes[0];
    return (
        <Admin
            title="Shop Admin"
            dataProvider={dataProvider}
            store={store}
            queryClient={queryClient}
            dashboard={Dashboard}
            loginPage={false}
            layout={Layout}
            i18nProvider={i18nProvider}
            disableTelemetry
            theme={selected.single}
            lightTheme={selected.light}
            darkTheme={selected.dark}
            defaultTheme="light"
        >
            <CustomRoutes><Route path="/segments" element={<Segments />} /></CustomRoutes>
            <Resource name="customers" {...visitors} />
            <Resource name="orders" {...orders} />
            <Resource name="invoices" {...invoices} />
            <Resource name="products" {...products} />
            <Resource name="categories" {...categories} />
            <Resource name="reviews" {...reviews} />
        </Admin>
    );
};

export default function AppWrapper(props: AppProps) {
    // UI preferences only, recreated for a different Room. Records live in House.
    const store = useMemo(() => memoryStore(), []);
    return <StoreContextProvider value={store}><App {...props} store={store} /></StoreContextProvider>;
}
