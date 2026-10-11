import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useDataProvider } from 'react-admin';
import { isAttachmentReference, safePoster } from './assets';
import type { ShopDataProvider } from './house';

/** Infer only known raster signatures; absent/generic transport MIME is not a format. */
export async function verifiedRaster(blob: Blob, declaredType?: string | null): Promise<Blob | undefined> {
    if (blob.size > 10 * 1024 * 1024) return undefined;
    const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    let detected: string | undefined;
    if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) detected = 'image/jpeg';
    else if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) detected = 'image/png';
    else if (text.startsWith('GIF87a') || text.startsWith('GIF89a')) detected = 'image/gif';
    else if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') detected = 'image/webp';
    else if (text.slice(4, 8) === 'ftyp' && ['avif', 'avis'].includes(text.slice(8, 12))) detected = 'image/avif';
    if (!detected) return undefined;
    // Never override an explicit unsafe or mismatched type, even if the header looks like a raster.
    for (const declaration of [blob.type, declaredType]) {
        const type = declaration?.split(';', 1)[0].trim().toLowerCase();
        if (type && type !== 'application/octet-stream' && type !== detected) return undefined;
    }
    // Give the browser the verified format; these are the identical, already hash-checked bytes.
    return blob.type === detected ? blob : blob.slice(0, blob.size, detected);
}
export async function isSafeRaster(blob: Blob, declaredType?: string | null): Promise<boolean> {
    return Boolean(await verifiedRaster(blob, declaredType));
}

/** Lazy, Room-scoped attachment reads. The stored value is never assigned to src. */
export function RoomImage({ value, alt, className, style }: {
    value?: unknown; alt: string; className?: string; style?: CSSProperties;
}) {
    const provider = useDataProvider<ShopDataProvider>();
    const element = useRef<HTMLImageElement>(null);
    const [visible, setVisible] = useState(false);
    const [resolved, setResolved] = useState<{ value: unknown; provider: ShopDataProvider; url: string }>();
    const [failure, setFailure] = useState<{ value: unknown; message: string }>();
    const local = safePoster(value);
    const url = resolved && resolved.value === value && resolved.provider === provider ? resolved.url : undefined;
    const error = failure && failure.value === value ? failure.message : undefined;
    useEffect(() => {
        if (visible || !element.current) return;
        if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '160px' });
        observer.observe(element.current);
        return () => observer.disconnect();
    }, [visible]);
    useEffect(() => {
        if (!visible || !isAttachmentReference(value)) return;
        let disposed = false;
        let objectUrl: string | undefined;
        provider.getAttachment(value).then(async ({ blob, status, type }) => {
            if (!blob) throw new Error(status === 'not_saved' ? 'This Room image is still saving.' : 'The Room image could not be read.');
            const raster = await verifiedRaster(blob, type);
            if (!raster) throw new Error(`The Room file is not a supported raster image. Blob MIME: ${(blob.type || '(none)').slice(0, 64)}; attachment MIME: ${(type || '(none)').slice(0, 64)}.`);
            if (disposed) return;
            objectUrl = URL.createObjectURL(raster);
            setResolved({ value, provider, url: objectUrl });
            setFailure(undefined);
        }).catch((error: unknown) => {
            if (!disposed) setFailure({ value, message: error instanceof Error ? error.message : String(error) });
        });
        return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [provider, value, visible]);
    const source = error ? undefined : local ?? url;
    // Keep the element measurable for IntersectionObserver, without fake artwork.
    return <img ref={element} src={source} alt={alt}
        className={className} style={style} loading="lazy" decoding="async"
        title={error} onError={() => setFailure({ value, message: 'The Room image could not be decoded.' })} />;
}
