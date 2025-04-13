declare namespace JSX {
  interface IntrinsicElements {
    div: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLDivElement> & {
        'data-attribution'?: string;
        'data-page_id'?: string;
        'data-theme_color'?: string;
      },
      HTMLDivElement
    >;
  }
}
