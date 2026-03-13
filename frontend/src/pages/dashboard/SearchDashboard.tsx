import { Search } from "lucide-react";


interface SearchDashboardProps {
  searchQuery: string;
  handleSearchQuery: (value: string) => void;
}

const SearchDashboard = ({
  searchQuery,
  handleSearchQuery,
}: SearchDashboardProps) => {
  return (
    <div className="p-6 border-b border-gray-800">
      <div className="relative">
        <Search
          className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2"
          size={20}
        />
        <input
          type="text"
          placeholder="Search products by name or category..."
          value={searchQuery}
          onChange={(e) => handleSearchQuery(e.target.value)}
          className="w-full py-3 pl-12 pr-4 text-white placeholder-gray-500 transition-all bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent"
        />
      </div>
    </div>
  );
};

export default SearchDashboard;
