/** subset-font（型の定義がないので、使うところだけ書く） */
declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2';
    preserveNameIds?: number[];
  }
  export default function subsetFont(buffer: Buffer, text: string, options?: SubsetFontOptions): Promise<Buffer>;
}
