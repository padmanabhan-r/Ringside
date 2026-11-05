import { currentSession } from "@/lib/session";
import { Books } from "./books";
import { loadBooks } from "./data";
import s from "./books.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books" };

export default async function BooksPage() {
  const data = await loadBooks(await currentSession());
  // The AG Studio licence key isn't a secret: AG documents it as shipped to the browser. Without one, Studio shows
  // its trial watermark.
  const licenseKey = process.env.AG_STUDIO_LICENSE_KEY || undefined;
  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1 className={s.title}>Books</h1>
        <p className={s.sub}>Your week at a glance.</p>
      </header>
      <Books data={data} licenseKey={licenseKey} />
    </div>
  );
}
