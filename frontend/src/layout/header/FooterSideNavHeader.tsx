const FooterSideNavHeader = () => {
  return (
    <footer className="pb-6 border-t border-zinc-200">
      <div className="px-4 pt-4">
        <button className="flex items-center justify-between w-full py-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-5 rounded-sm bg-zinc-300" />
            <span className="text-[12px] font-semibold tracking-wide text-zinc-900">
              IDR
            </span>
          </div>

          <div className="rounded bg-zinc-300 w-18 h-18" />
        </button>
      </div>
    </footer>
  );
};

export default FooterSideNavHeader;
