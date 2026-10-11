import { RoomImage } from '../RoomImage';
import * as React from 'react';
import { styled } from '@mui/material/styles';
import { useRecordContext } from 'react-admin';
import { Product } from '../types';

const Img = styled(RoomImage)({
    width: 25,
    height: 25,
    maxWidth: 25,
    maxHeight: 25,
    verticalAlign: 'middle',
});

const ThumbnailField = (_: { source: string; label?: string }) => {
    const record = useRecordContext<Product>();
    if (!record) return null;
    return <Img value={record.thumbnail} alt="" />;
};

export default ThumbnailField;
