import {
    RichTextInput, RichTextInputToolbar, DefaultEditorOptions,
    LevelSelect, FormatButtons, ListButtons, QuoteButtons, ClearButtons,
    type RichTextInputProps,
} from 'ra-input-rich-text';
import { sanitizeRichText } from '../safeRichText';

const editorOptions = {
    ...DefaultEditorOptions,
    extensions: DefaultEditorOptions.extensions
        ?.filter(extension => extension.name !== 'image' && extension.name !== 'link')
        .map(extension => extension.name === 'starterKit' ? extension.configure({ link: false }) : extension),
    editorProps: { transformPastedHTML: sanitizeRichText },
};

/** Formatting stays local; no remote image, URL, embed, style, or link controls. */
export default function SafeRichTextInput(props: RichTextInputProps) {
    return <RichTextInput
        {...props}
        format={sanitizeRichText}
        parse={sanitizeRichText}
        editorOptions={editorOptions}
        toolbar={<RichTextInputToolbar><LevelSelect /><FormatButtons /><ListButtons /><QuoteButtons /><ClearButtons /></RichTextInputToolbar>}
    />;
}
