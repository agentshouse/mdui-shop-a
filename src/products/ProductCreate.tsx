import {BusinessDraft} from '../BusinessDraft';
import * as React from 'react';
import {
    Create,
    TabbedForm,
    useCreateContext,
    useDefaultTitle,
} from 'react-admin';
import { ProductEditDetails } from './ProductEditDetails';
import RichTextInput from './SafeRichTextInput';
import { ProductImageInput } from './ProductImageInput';

const ProductTitle = () => {
    const appTitle = useDefaultTitle();
    const { defaultTitle } = useCreateContext();

    return (
        <>
            <title>{`${appTitle} - ${defaultTitle}`}</title>
            <span>{defaultTitle}</span>
        </>
    );
};

const ProductCreate = () => (
    <Create title={<ProductTitle />}>
        <TabbedForm defaultValues={{ sales: 0, stock: 0, image: '', thumbnail: '' }}>
            <TabbedForm.Tab
                label="resources.products.tabs.image"
                sx={{ maxWidth: '40em' }}
            >
                <BusinessDraft />
                <ProductImageInput source="image" />
                <ProductImageInput source="thumbnail" />
            </TabbedForm.Tab>
            <TabbedForm.Tab
                label="resources.products.tabs.details"
                path="details"
                sx={{ maxWidth: '40em' }}
            >
                <ProductEditDetails />
            </TabbedForm.Tab>
            <TabbedForm.Tab
                label="resources.products.tabs.description"
                path="description"
            >
                <RichTextInput source="description" label="" />
            </TabbedForm.Tab>
        </TabbedForm>
    </Create>
);

export default ProductCreate;
