import { IoSearchOutline } from "react-icons/io5";

interface ProductSearchInputProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

const ProductSearchInput = ({
  searchQuery,
  onSearchChange,
  placeholder = "Cari nama produk",
}: ProductSearchInputProps) => {
  return (
    <div className="flex items-center gap-2 px-2 py-3 m-2 border border-zinc-200 rounded-2xl">
      <IoSearchOutline className="text-[1.3rem]" />
      <input
        type="text"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent placeholder:text-[.9rem] placeholder:text-zinc-500 outline-none"
      />
    </div>
  );
};

export default ProductSearchInput;

