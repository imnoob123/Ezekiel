import NavRail from "@/components/NavRail";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavRail />
      <main className="mx-auto w-full max-w-[520px] px-4 pb-28 pt-8 md:pl-[76px] md:pt-12 md:max-w-[596px]">
        {children}
      </main>
    </>
  );
}
