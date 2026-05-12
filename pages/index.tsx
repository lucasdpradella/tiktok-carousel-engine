import React from 'react';

export default function Home() {
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 40,
        maxWidth: 720,
        margin: '0 auto',
        lineHeight: 1.5,
      }}
    >
      <h1>tiktok-carousel-engine — render</h1>
      <p>
        Serviço de composição de slides via <code>@vercel/og</code>. Endpoint:
        <br />
        <code>/api/slide?template=...&titulo=...&corpo=...&bg=...&numero=...&total=...</code>
      </p>
      <p>
        Templates disponíveis: <code>financa-capa</code>, <code>financa-corpo</code>,{' '}
        <code>marca-capa</code>, <code>marca-corpo</code>.
      </p>
      <p>
        <a href="/api/healthcheck">healthcheck</a> ·{' '}
        <a href="/api/slide?template=financa-capa&titulo=Exemplo+de+capa&bg=https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3">
          preview
        </a>
      </p>
    </div>
  );
}
