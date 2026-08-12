declare module 'decode-html' {
  export default function decodeHtml(value: string): string
}

declare module 'mozjpeg-js' {
  export function encode(
    image: { data: Uint8ClampedArray | Uint8Array; width: number; height: number },
    quality?: number,
  ): { data: Uint8Array; width: number; height: number }
}

declare module '*.cjs' {
  const value: unknown
  export default value
}
