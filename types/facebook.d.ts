interface Window {
  FB?: {
    init(params: {
      xfbml?: boolean;
      version: string;
      appId?: string;
      autoLogAppEvents?: boolean;
    }): void;
    XFBML: {
      parse(dom?: Element): void;
    };
  };
  fbAsyncInit?: () => void;
}

// Add global jsx namespace to support Facebook's custom attributes
declare global {
  namespace JSX {
    interface HTMLAttributes<T> extends React.HTMLAttributes<T> {
      // Facebook chat widget custom attributes
      attribution?: string;
      page_id?: string;
      theme_color?: string;
      greeting_dialog_display?: string;
      logged_in_greeting?: string;
      logged_out_greeting?: string;
    }
  }
}

export {};
