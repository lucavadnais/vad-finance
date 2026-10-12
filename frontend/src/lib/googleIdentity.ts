// Google Identity Services: Google's script for the "Se connecter avec Google"
// button. Loaded from Google on demand, once. Only the parts the app uses are
// typed (https://developers.google.com/identity/gsi/web/reference/js-reference).

interface CredentialResponse {
  // The ID token (a JWT signed by Google), checked by the backend
  credential: string;
}

export interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: CredentialResponse) => void }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

const SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleIdentity> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('GIS missing')));
    script.onerror = () => {
      // Tried again next time (e.g. back online)
      loading = null;
      script.remove();
      reject(new Error(`Could not load ${SRC}`));
    };
    document.head.append(script);
  });
  return loading;
}
