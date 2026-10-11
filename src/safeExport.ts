import { downloadCSV, type Exporter } from 'react-admin';

const columns: Record<string, string[]> = {
    customers: 'id first_name last_name email address zipcode city stateAbbr birthday first_seen last_seen has_ordered latest_purchase has_newsletter groups nb_orders total_spent'.split(' '),
    categories: ['id', 'name'],
    products: 'id category_id reference width height price thumbnail image description stock sales'.split(' '),
    orders: 'id reference date customer_id basket total_ex_taxes delivery_fees tax_rate taxes total status returned'.split(' '),
    invoices: 'id date order_id customer_id total_ex_taxes delivery_fees tax_rate taxes total'.split(' '),
    reviews: 'id date status order_id product_id customer_id rating comment'.split(' '),
};

export function csvCell(value: unknown): string {
    let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}
export function exportRows(records: Record<string, unknown>[], resource: string): string {
    const fields = columns[resource];
    if (!fields) throw new Error('Unsupported export resource.');
    return [fields.map(csvCell).join(','), ...records.map(record => fields.map(field => csvCell(record[field])).join(','))].join('\r\n');
}
/** Export visible business fields only; never expose Room draft/snapshot metadata. */
export const safeExporter: Exporter = (records, _fetchRelated, _provider, resource) => {
    if (!resource) throw new Error('Select a resource before exporting.');
    downloadCSV(exportRows(records, resource), resource);
};
