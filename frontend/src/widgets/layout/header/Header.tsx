import { useState } from "react";
import { FiMenu } from "react-icons/fi";
import { QuantityProvider } from "@/features/cart/cart-context/QuantityContext";
import { Link } from "react-router-dom";

import UseTrigger from "@/shared/lib/hooks/CustomHookShare";
import SideNavHeader from "./SideNavHeader";
import logo from "@/shared/assets/images/logo_primary.webp";
import SideCart from "@/features/cart/SideCart";
import HeaderNav from "./HeaderNav";
import HeaderActions from "./HeaderActions";

function Header() {
  const [cartTrigger, setCartTrigger] = useState<boolean>(false);
  const { trigger, handleTrigger } = UseTrigger();

  const handleCartTrigger = () => {
    setCartTrigger((prev) => !prev);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-border">
      <div className="flex items-center justify-between w-full h-16 mx-auto px-padding_primary lg:h-20">
        {/* Left section - Menu & Logo */}
        <div className="flex items-center gap-4">
          <button className="lg:hidden" onClick={handleTrigger}>
            <FiMenu className="w-6 h-6" />
          </button>

          <Link to={"/"} className="w-28" aria-label="CALLE home">
            <img src={logo} alt="logo_primary class" />
          </Link>
        </div>

        {/* header navigasi */}
        <HeaderNav />

        {/* Right section - Cart & Profile */}
        <HeaderActions handleCart={handleCartTrigger} />
      </div>

      <SideNavHeader triggerNav={trigger} handleTriggerNav={handleTrigger} />

      <QuantityProvider>
        <SideCart cartTrigger={cartTrigger} onClose={handleCartTrigger} />
      </QuantityProvider>
    </header>
  );
}

export default Header;
