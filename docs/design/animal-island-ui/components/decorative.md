# Decorative — pixel spec

Exact values for the scene-setting pieces that carry the island theme: Time, Phone, Footer and Wallet.

## Footer (copyright bar)

A copyright bar that renders `© {year} {text}` — the year is fetched dynamically (current year), and the text defaults to `All Rights Reserved.`.

```tsx
<Footer />                  // © 2026 All Rights Reserved.
<Footer text="Acme Ltd." /> // custom text
<Footer text="Acme" year={2020} />
```

```less
.footer {
    color: #807d75;
    font-size: 12px;
    padding: 16px 0;
    text-align: center;
}
```

- The `year` defaults to the current year (`new Date().getFullYear()`); pass `year` to override it. The `text` replaces `All Rights Reserved.`.
- Styling is fully overridable via `style` / `className`.

