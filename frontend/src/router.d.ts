import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    // Shown in the browser tab
    title?: string;
    // Readable without signing in (the legal pages)
    public?: boolean;
  }
}
