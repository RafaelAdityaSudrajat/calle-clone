
import LayoutSecondary from "../../layout/LayoutSecondary";
import AccountAction from "./AccountAction";
import TabsCard from "./TabsCard";
import PopupLogin from "../../feature/auth/PopupLogin";
import PopupRegister from "../../feature/auth/PopupRegister";
import { useAuthModal } from "../../feature/auth/AuthModalContext";

export default function Account() {
  
  const { activeAuthPopup } = useAuthModal()

  return (
    <LayoutSecondary>
      <div className="flex justify-center min-h-screen pt-3 bg-gray-100">
        <div className="px-4 lg:w-[55%] mx-auto">
          {/* Title */}
          <h1 className="mb-6 text-xl font-semibold text-gray-800">
            My Account
          </h1>

          {/* Promo Card */}
          <div className="flex flex-col gap-4 p-3 bg-white border border-gray-200 rounded-lg shado w-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xs font-semibold text-gray-800">
                Enjoy Special Discounts and Stay Connected
              </h2>
              <p className="max-w-xl mt-1 text-xs text-gray-500">
                Get access to exclusive discounts while keeping track of your
                orders and chats with ease. Stay updated on your purchases and
                engage with us seamlessly, all in one place.
              </p>
            </div>

            {/* Account Action */}
            <AccountAction/>
          </div>

          {/* Orders Card */}
          <TabsCard />
        </div>
      </div>

      {/* login modal pop up */}

      {activeAuthPopup === "login" && <PopupLogin />}

      {/* Register modal pop up */}
      {activeAuthPopup === "register" && <PopupRegister />}
    </LayoutSecondary>
  );
}
