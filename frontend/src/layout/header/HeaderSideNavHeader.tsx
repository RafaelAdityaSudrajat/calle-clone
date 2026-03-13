
interface HeaderSideNavHeaderProps {
    onClose : () => void
}

const HeaderSideNavHeader = ({onClose} : HeaderSideNavHeaderProps) => {
  return (
    <div className="flex justify-between px-4 pt-4">
      <button aria-label="Search">
        <div className="bg-red-300 rounded w-[1.3rem] h-[1.3rem]" />
      </button>

      <button aria-label="Close" onClick={onClose}>
        <div className="bg-red-300 rounded w-[1.3rem] h-[1.3rem]" />
      </button>
    </div>
  );
};

export default HeaderSideNavHeader;
