import './globals.css';

export const metadata = {
  title: 'NOVA — AI Companion',
  description: 'A persistent, emotionally dynamic AI companion with personality-driven responses and memory-driven callbacks.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
