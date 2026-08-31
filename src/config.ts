export const WORKER_BASE: string = (import.meta.env.VITE_WORKER_BASE as string | undefined)?.replace(/\/+$/, '') ?? ''
