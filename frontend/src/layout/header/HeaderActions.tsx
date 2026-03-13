import { FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";
import Cart from "./Cart";

function HeaderActions({ handleCart }: { handleCart: () => void }) {
  return (
    <div className="flex items-center gap-2 text-[.9rem] lg:gap-6">
      {/* Currency */}
      <div className="items-center hidden gap-2 lg:flex">
        <img
          src="https://d2nvjoftj891ay.cloudfront.net/flags/id.svg"
          className="h-4 border"
        />
        <span>IDR</span>
      </div>

      {/* Cart */}
      <Cart handleCart={handleCart} />

      {/* Profile */}
      <Link to={"/account"}>
        <button>
          <FiUser className="w-6 h-6" />
        </button>
      </Link>
    </div>
  );
}

export default HeaderActions;
