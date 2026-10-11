import {BusinessDraft} from '../BusinessDraft';
import * as React from 'react';
import {
    Create,
    DateInput,
    SimpleForm,
    TextInput,
    useTranslate,
    email,
    useDefaultTitle,
    useCreateContext,
} from 'react-admin';
import { Box, Typography } from '@mui/material';

export const validateForm = (
    values: Record<string, any>
): Record<string, any> => {
    const errors = {} as any;
    if (!values.first_name) {
        errors.first_name = 'ra.validation.required';
    }
    if (!values.last_name) {
        errors.last_name = 'ra.validation.required';
    }
    if (!values.email) {
        errors.email = 'ra.validation.required';
    } else {
        const error = email()(values.email);
        if (error) {
            errors.email = error;
        }
    }
    return errors;
};

const VisitorTitle = () => {
    const appTitle = useDefaultTitle();
    const { defaultTitle } = useCreateContext();
    return (
        <>
            <title>{`${appTitle} - ${defaultTitle}`}</title>
            <span>{defaultTitle}</span>
        </>
    );
};

const VisitorCreate = () => (
    <Create title={<VisitorTitle />}>
        <SimpleForm
            sx={{ maxWidth: 500 }}
            defaultValues={{
                first_seen: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                has_ordered: false,
                has_newsletter: false,
                groups: [],
                nb_orders: 0,
                total_spent: 0,
            }}
            validate={validateForm}
        >
            <BusinessDraft />
            <SectionTitle label="resources.customers.fieldGroups.identity" />
            <Box
                sx={{
                    display: { xs: 'block', sm: 'flex', width: '100%' },
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        mr: { xs: 0, sm: '0.5em' },
                    }}
                >
                    <TextInput source="first_name" isRequired />
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        ml: { xs: 0, sm: '0.5em' },
                    }}
                >
                    <TextInput source="last_name" isRequired />
                </Box>
            </Box>
            <TextInput type="email" source="email" isRequired />
            <DateInput source="birthday" />
            <Separator />
            <SectionTitle label="resources.customers.fieldGroups.address" />
            <TextInput source="address" multiline helperText={false} />
            <Box
                sx={{
                    display: { xs: 'block', sm: 'flex' },
                }}
            >
                <Box
                    sx={{
                        flex: 2,
                        mr: { xs: 0, sm: '0.5em' },
                    }}
                >
                    <TextInput source="city" helperText={false} />
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        mr: { xs: 0, sm: '0.5em' },
                    }}
                >
                    <TextInput source="stateAbbr" helperText={false} />
                </Box>
                <Box
                    sx={{
                        flex: 2,
                    }}
                >
                    <TextInput source="zipcode" helperText={false} />
                </Box>
            </Box>
        </SimpleForm>
    </Create>
);

const SectionTitle = ({ label }: { label: string }) => {
    const translate = useTranslate();

    return (
        <Typography variant="h6" gutterBottom>
            {translate(label as string)}
        </Typography>
    );
};

const Separator = () => (
    <Box
        sx={{
            pt: '1em',
        }}
    />
);

export default VisitorCreate;
