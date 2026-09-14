import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './index.module.css';

function SectionCard({
  title,
  description,
  to,
  accent,
}: {
  title: string;
  description: string;
  to: string;
  accent: 'blue' | 'purple';
}) {
  return (
    <Link to={to} className={`${styles.card} ${styles[`card--${accent}`]}`}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDescription}>{description}</p>
    </Link>
  );
}

export default function Home(): React.ReactNode {
  const logoUrl = useBaseUrl('/img/logo.png');

  return (
    <Layout title="TISC Editor" description="Documentation for TISC Editor">
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>TISC Editor</h1>
            <p className={styles.tagline}>A focused editor for writing Typst documents</p>
          </div>
          <img src={logoUrl} alt="" className={styles.logo} aria-hidden="true" />
        </div>

        <p className={styles.intro}>
          Welcome to the documentation site of <strong>TISC Editor</strong>. The site is
          organized in two sections:
        </p>

        <div className={styles.cardsGrid}>
          <SectionCard
            accent="blue"
            title="User Tutorial"
            description="For end users: installing the editor, writing your first document and using the core features."
            to="/docs/tutorial/intro"
          />
          <SectionCard
            accent="purple"
            title="Technical Documentation"
            description="Architecture, internals and configuration for anyone extending or building on TISC Editor."
            to="/docs/techdocs/intro"
          />
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contributing</h2>
          <p className={styles.sectionText}>
            Contributions are welcome — do not hesitate to populate the site. Content is
            written in <code>Markdown</code>. Edit the files in <code>docs/</code> directly on
            GitHub (or clone the repository).
          </p>
        </section>

        <a
          className={styles.editLink}
          href="https://github.com/isc-hei/tisc-editor/edit/main/src/pages/index.tsx"
          target="_blank"
          rel="noopener noreferrer"
        >
          Edit this page
        </a>
      </main>
    </Layout>
  );
}