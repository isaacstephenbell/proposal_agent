import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata = {
  title: "Proposal Writing Assistant - RAG-Powered Proposal Generation",
  description: "Generate structured proposals based on historical success patterns using AI-powered RAG technology.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
