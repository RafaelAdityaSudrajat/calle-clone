// src/components/Sidebar.tsx
export default function Sidebar() {
  return (
    <aside className="static bottom-0 left-0 flex flex-col justify-between w-64 p-5 bg-white shadow-sm rounded-tr-3xl rounded-br-3xl max-h-[100vh]">
      <div>
        {/* Profile */}
        <div className="flex items-center gap-3 mb-10">
          <img
            src="https://i.pravatar.cc/40"
            className="w-10 h-10 rounded-full"
          />
          <div>
            <p className="font-semibold">Jhon doe</p>
            <span className="text-xs text-blue-500">Premium</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="space-y-2">
          <MenuItem label="Add Product" />
        </nav>
      </div>

      <button className="p-4 text-sm text-white bg-blue-600 rounded-xl">
        Contact Us
      </button>
    </aside>
  );
}

function MenuItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div
      className={`px-4 py-2 rounded-xl cursor-pointer text-sm ${
        active ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </div>
  );
}
