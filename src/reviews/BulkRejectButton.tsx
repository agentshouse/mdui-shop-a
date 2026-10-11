import * as React from 'react';
import ThumbDown from '@mui/icons-material/ThumbDown';

import {
    Button,
    useUpdateMany,
    useNotify,
    useUnselectAll,
    Identifier,
    useListContext,
} from 'react-admin';

const noSelection: Identifier[] = [];

const BulkRejectButton = () => {
    const { selectedIds = noSelection } = useListContext();
    const notify = useNotify();
    const unselectAll = useUnselectAll('reviews');

    const [updateMany, { isPending }] = useUpdateMany(
        'reviews',
        { ids: selectedIds, data: { status: 'rejected' } },
        {
            mutationMode: 'pessimistic',
            onSuccess: () => {
                notify('resources.reviews.notifications.rejected_success', {
                    type: 'info',
                    undoable: false,
                });
                unselectAll();
            },
            onError: () => {
                notify('resources.reviews.notifications.rejected_error', {
                    type: 'error',
                });
            },
        }
    );

    return (
        <Button
            label="resources.reviews.action.reject"
            onClick={() => updateMany()}
            disabled={isPending}
        >
            <ThumbDown />
        </Button>
    );
};

export default BulkRejectButton;
