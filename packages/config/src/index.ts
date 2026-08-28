export interface ServiceConfig { readonly serviceName: string; readonly environment: string; }
export const environment = (): string => process.env.NODE_ENV ?? "development";
