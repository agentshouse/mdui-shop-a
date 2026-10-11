import * as React from 'react';
import { Layout } from 'react-admin';
import AppBar from './AppBar';
import Menu from './Menu';

export default ({ children }: { children: React.ReactNode }) => (
    <Layout
        appBar={AppBar}
        appBarAlwaysOn
        menu={Menu}
        sx={{
            minWidth: 0,
            '& .RaLayout-appFrame': { marginTop: { xs: 0, sm: 0 } },
            '& .RaLayout-content': { minWidth: 0 },
            '& .RaSidebar-fixed': { position: 'sticky', top: 0 },
            backgroundColor: theme =>
                (theme.vars || theme).palette.background.default,
        }}
    >
        {children}
    </Layout>
);
