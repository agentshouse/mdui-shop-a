import { initials } from '../assets';
import { initialsAvatarSx } from './initialsAvatarSx';
import { RoomImage } from '../RoomImage';
import * as React from 'react';
import { Avatar, SxProps } from '@mui/material';
import { FieldProps, useRecordContext } from 'react-admin';
import { Customer } from '../types';

interface Props extends Omit<FieldProps<Customer>, 'source'> {
    sx?: SxProps;
    size?: string;
}

const AvatarField = ({ size = '25', sx }: Props) => {
    const record = useRecordContext<Customer>();
    if (!record) return null;
    return (
        <Avatar
            style={{ width: parseInt(size, 10), height: parseInt(size, 10) }}
            sx={[
                !record.avatar && initialsAvatarSx,
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            alt={`${record.first_name} ${record.last_name}`}>{record.avatar ? <RoomImage value={record.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(record)}</Avatar>
    );
};

export default AvatarField;
