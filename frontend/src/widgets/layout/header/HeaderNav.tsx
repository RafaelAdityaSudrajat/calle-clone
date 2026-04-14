import { Link } from "react-router-dom";

const HeaderNav = () => {
  const links = [
    { href: "/products", label: "CATALOG" },
    { href: "/community", label: "COMMUNITY" }, // typo COMUNITTY 👀
    { href: "/archives", label: "ARCHIVES" },
    { href: "/about", label: "ABOUT" },
  ];

  return (
    <nav className="hidden lg:block text-[.9rem]">
      <ul className="flex items-center gap-2">
        {links.map((link) => (
          <Link to={link.href} key={link.href}>
            <li className="px-5 py-2 transition-all duration-500 cursor-pointer hover:bg-gray-300 rounded-xl">
              {link.label}
            </li>
          </Link>
        ))}
      </ul>
    </nav>
  );
};

export default HeaderNav;
