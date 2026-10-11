import {useWatch} from 'react-hook-form';
import { SelectInput, useRecordContext } from 'react-admin';
import { isAttachmentReference, posterChoices } from '../assets';

/** Preserve the opened attachment choice when editing unrelated product fields. */
export function ProductImageInput({ source }: { source: 'image' | 'thumbnail' }) {
    const record = useRecordContext();
    const current = record?.[source];
    const draftValue = useWatch({name: source});
    const choices = isAttachmentReference(current)
        ? [{ id: current, name: 'Current Room image' }, ...posterChoices]
        : posterChoices;
    const draftChoices = isAttachmentReference(draftValue) && !choices.some(choice => choice.id === draftValue)
        ? [{id: draftValue, name: 'Draft Room image'}, ...choices] : choices;
    return <SelectInput source={source} choices={draftChoices} emptyText="No image" emptyValue=""
        helperText="Keep the current Room image, select bundled artwork, or clear it." />;
}
