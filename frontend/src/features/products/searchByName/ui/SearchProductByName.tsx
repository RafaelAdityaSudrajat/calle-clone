import { IoSearchOutline } from "react-icons/io5";

interface SearchProductByNameProps {
  searchQuery: string;
  handleSearchQuery: (value: string) => void;
  placeholder?: string;
}

const SearchProductByName = ({
  searchQuery,
  handleSearchQuery,
  placeholder = "Cari nama produk",
}: SearchProductByNameProps) => {
  return (
    <div className="flex items-center gap-2 px-2 py-3 m-2 border border-zinc-200 rounded-2xl">
      <IoSearchOutline className="text-[1.3rem]" />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => handleSearchQuery(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent placeholder:text-[.9rem] placeholder:text-zinc-500 outline-none"
      />
    </div>
  );
};

export default SearchProductByName;
