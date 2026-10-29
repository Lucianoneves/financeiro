import Link from "next/link";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/recebiveis">Recebíveis</Link>
          <Link href="/antecipacoes">Antecipações</Link>
        </nav>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>
      {children}
    </div>
  );
}
