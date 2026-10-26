import './globals.css';

export const metadata = {
  title: 'QRS Tasks',
  description: 'The team board for the website, Facebook Pages, Google Business Profile, off-page SEO and content.',
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#0b2440' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
