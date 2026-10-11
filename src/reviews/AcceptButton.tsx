import {useFormContext} from 'react-hook-form';
import * as React from 'react';
import Button from '@mui/material/Button';
import ThumbUp from '@mui/icons-material/ThumbUp';
import {
    useTranslate,
    useSaveContext,
    useNotify,
    useRedirect,
    useRecordContext,
} from 'react-admin';
import { Review } from './../types';

/**
 * This custom button demonstrate using useUpdate to update data
 */
const AcceptButton = () => {
    const translate = useTranslate();
    const notify = useNotify();
    const redirectTo = useRedirect();
    const record = useRecordContext<Review>();

    const {save, saving: isPending} = useSaveContext();
    const {setValue, handleSubmit} = useFormContext();
    const approve = () => {
        setValue('status', 'accepted', {shouldDirty: true});
        void handleSubmit(values => save?.(values, {
            onSuccess: () => {
                notify('resources.reviews.notifications.approved_success', {type: 'info', undoable: false});
                redirectTo('/reviews');
            },
            onError: () => notify('resources.reviews.notifications.approved_error', {type: 'error'}),
        }))();
    };
    return record && record.status === 'pending' ? (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => approve()}
            sx={{ borderColor: theme => theme.palette.success.main }}
            startIcon={
                <ThumbUp sx={{ color: theme => theme.palette.success.main }} />
            }
            disabled={isPending}
        >
            {translate('resources.reviews.action.accept')}
        </Button>
    ) : (
        <span />
    );
};

export default AcceptButton;
