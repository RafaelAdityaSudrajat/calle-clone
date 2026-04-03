import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { RiArrowDropDownLine } from "react-icons/ri";

interface DropDownPrimaryProps {
  label?: string ;
}

export default function DropDownPrimary({ label = "options" }: DropDownPrimaryProps) {
  return (
    <Menu as="div" className="relative inline-block">
      <MenuButton className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-black px-3 py-2 text-sm font-semibold text-white inset-ring-1 inset-ring-white/5 hover:bg-white hover:text-black">
        {label}
        <RiArrowDropDownLine
          aria-hidden="true"
          className="-mr-1 text-gray-400 size-5"
        />
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-10 w-56 mt-2 transition origin-top-right bg-black rounded-md outline-1 -outline-offset-1 outline-white/10 data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in"
      >
        <div className="py-1">
          <MenuItem>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-white data-focus:bg-white/5 data-focus:text-white data-focus:outline-hidden"
            >
              Account settings
            </a>
          </MenuItem>
          <MenuItem>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-white data-focus:bg-white/5 data-focus:text-white data-focus:outline-hidden"
            >
              Support
            </a>
          </MenuItem>
          <MenuItem>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-white data-focus:bg-white/5 data-focus:text-white data-focus:outline-hidden"
            >
              License
            </a>
          </MenuItem>
          <form action="#" method="POST">
            <MenuItem>
              <button
                type="submit"
                className="block w-full px-4 py-2 text-sm text-left text-white data-focus:bg-white/5 data-focus:text-white data-focus:outline-hidden"
              >
                Sign out
              </button>
            </MenuItem>
          </form>
        </div>
      </MenuItems>
    </Menu>
  );
}
