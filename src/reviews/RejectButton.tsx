import {useFormContext} from 'react-hook-form';
import * as React from 'react';
import Button from '@mui/material/Button';
import ThumbDown from '@mui/icons-material/ThumbDown';
import {
    useTranslate,
    useSaveContext,
    useNotify,
    useRedirect,
    useRecordContext,
} from 'react-admin';
import { Review } from '../types';

/**
 * This custom button demonstrate using a custom action to update data
 */
const RejectButton = () => {
    const translate = useTranslate();
    const notify = useNotify();
    const redirectTo = useRedirect();
    const record = useRecordContext<Review>();

    const {save, saving: isPending} = useSaveContext();
    const {setValue, handleSubmit} = useFormContext();
    const reject = () => {
        setValue('status', 'rejected', {shouldDirty: true});
        void handleSubmit(values => save?.(values, {
            onSuccess: () => {
                notify('resources.reviews.notifications.rejected_success', {type: 'info', undoable: false});
                redirectTo('/reviews');
            },
            onError: () => notify('resources.reviews.notifications.rejected_error', {type: 'error'}),
        }))();
    };
    return record && record.status === 'pending' ? (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => reject()}
            sx={{ borderColor: theme => theme.palette.error.main }}
            startIcon={
                <ThumbDown sx={{ color: theme => theme.palette.error.main }} />
            }
            disabled={isPending}
        >
            {translate('resources.reviews.action.reject')}
        </Button>
    ) : (
        <span />
    );
};

export default RejectButton;
