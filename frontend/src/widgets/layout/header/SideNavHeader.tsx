import BackDrop from "@/shared/ui/BackDrop";
import FooterSideNavHeader from "./FooterSideNavHeader";
import HeaderSideNavHeader from "./HeaderSideNavHeader";

interface MobileMenuLayoutProps {
  triggerNav: boolean;
  handleTriggerNav: () => void;
}

export default function MobileMenuLayout({
  triggerNav,
  handleTriggerNav,
}: MobileMenuLayoutProps) {

  
  return (
    <BackDrop trigger={triggerNav} onClose={handleTriggerNav}>
      <div
        className={`absolute top-0 left-0 z-50 min-h-screen w-[95%] max-w-[25rem] bg-white
          transform transition-transform duration-300 ease-out
          ${triggerNav ? "translate-x-0" : "-translate-x-full"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel */}
        <div className="flex flex-col justify-between min-h-screen mx-auto">
          {/* Header */}
          <HeaderSideNavHeader onClose={handleTriggerNav} />

          <nav className="px-10">
            <button
              type="button"
              className="flex items-center justify-between w-full py-2 text-left"
            >
              <span className="text-[.8rem] uppercase tracking-wide text-zinc-900">
                Products
              </span>
            </button>

            <button
              type="button"
              className="flex items-center justify-between w-full py-2 text-left"
            >
              <span className="text-[.8rem] uppercase tracking-wide text-zinc-900">
                Products
              </span>
            </button>

            <button
              type="button"
              className="flex items-center justify-between w-full py-2 text-left"
            >
              <span className="text-[.8rem] uppercase tracking-wide text-zinc-900">
                Products
              </span>
            </button>
          </nav>

          {/* Footer */}
         <FooterSideNavHeader />
        </div>
      </div>
    </BackDrop>
  );
}
