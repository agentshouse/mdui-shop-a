const allowedTags = new Set(['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr']);
const droppedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'img', 'picture', 'source', 'video', 'audio', 'svg', 'math', 'link', 'meta', 'base', 'template']);
const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The template is inert. Rebuild allowed text formatting without any attributes. */
export function sanitizeRichText(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    const template = document.createElement('template');
    template.innerHTML = value;
    function clean(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = (node as Element).tagName.toLowerCase();
        if (droppedTags.has(tag)) return '';
        const content = Array.from(node.childNodes).map(clean).join('');
        if (!allowedTags.has(tag)) return content;
        if (tag === 'br' || tag === 'hr') return `<${tag}>`;
        return `<${tag}>${content}</${tag}>`;
    }
    return Array.from(template.content.childNodes).map(clean).join('');
}
