/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_EMAILJS_SERVICE_ID: string
  readonly VITE_EMAILJS_TEMPLATE_ID: string
  readonly VITE_EMAILJS_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'react-helmet' {
  import { ComponentType, ReactNode } from 'react';
  export interface HelmetProps {
    children?: ReactNode;
    title?: string;
    [key: string]: unknown;
  }
  export const Helmet: ComponentType<HelmetProps>;
  export default Helmet;
}

declare module 'qrcode' {
  const QRCode: {
    toDataURL: (text: string, options?: object) => Promise<string>;
  };
  export default QRCode;
}
