
import "./globals.css";

export const metadata = {
  title: "TenderBridge | Government Tender Matchmaking",
  description:
    "Discover government tenders and find opportunities that match your MSME business profile.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
