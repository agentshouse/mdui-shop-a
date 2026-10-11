import { RoomImage } from '../RoomImage';
import * as React from 'react';
import { Card } from '@mui/material';
import { useRecordContext } from 'react-admin';
import { Product } from '../types';

const Poster = () => {
    const record = useRecordContext<Product>();
    if (!record) return null;
    return (
        <Card sx={{ display: 'inline-block' }}>
            <RoomImage
                value={record.image}
                alt=""
                style={{ maxWidth: '42em', maxHeight: '15em', minHeight: '5em', maxInlineSize: '100%' }}
            />
        </Card>
    );
};

export default Poster;
