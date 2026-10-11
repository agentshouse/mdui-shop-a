import {BusinessNumberInput} from '../BusinessNumberInput';
import * as React from 'react';
import {
    ReferenceInput,
    required,
    SelectInput,
    TextInput,
} from 'react-admin';
import { InputAdornment, Grid } from '@mui/material';

export const ProductEditDetails = () => (
    <Grid container columnSpacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
            <TextInput source="reference" validate={req} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
            <ReferenceInput source="category_id" reference="categories">
                <SelectInput optionText="name" validate={req} />
            </ReferenceInput>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
            <BusinessNumberInput
                source="width"
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="start">cm</InputAdornment>
                    ),
                }}
                validate={req}
            />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
            <BusinessNumberInput
                source="height"
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="start">cm</InputAdornment>
                    ),
                }}
                validate={req}
            />
        </Grid>
        <Grid size={{ xs: 0, sm: 48 }} />
        <Grid size={{ xs: 12, sm: 4 }}>
            <BusinessNumberInput
                source="price"
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">$</InputAdornment>
                    ),
                }}
                validate={req}
            />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
            <BusinessNumberInput source="stock" validate={req} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
            <BusinessNumberInput source="sales" validate={req} />
        </Grid>
    </Grid>
);

const req = [required()];
