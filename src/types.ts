import type { Identifier } from 'react-admin';

export type ThemeName = 'light' | 'dark';
export type Category = { id: Identifier; name: string; image?: string };
export type Product = {
    id: Identifier; category_id: Identifier; reference: string;
    width: number; height: number; price: number; thumbnail: string;
    image: string; description: string; stock: number; sales: number;
};
export type Customer = {
    id: Identifier; first_name: string; last_name: string; email: string;
    address: string; zipcode: string; city: string; stateAbbr: string;
    birthday: string | null; first_seen: string; last_seen: string;
    has_ordered: boolean; latest_purchase: string; has_newsletter: boolean;
    avatar?: string; groups: string[]; nb_orders: number; total_spent: number;
};
export type BasketItem = { product_id: Identifier; quantity: number };
export type Order = {
    id: Identifier; reference: string; date: string; customer_id: Identifier;
    basket: BasketItem[]; total_ex_taxes: number; delivery_fees: number;
    tax_rate: number; taxes: number; total: number;
    status: 'ordered' | 'delivered' | 'cancelled'; returned: boolean;
};
export type Invoice = {
    id: Identifier; date: string; order_id: Identifier; customer_id: Identifier;
    total_ex_taxes: number; delivery_fees: number; tax_rate: number;
    taxes: number; total: number;
};
export type Review = {
    id: Identifier; date: string; status: 'accepted' | 'rejected' | 'pending';
    order_id: Identifier; product_id: Identifier; customer_id: Identifier;
    rating: number; comment: string;
};
