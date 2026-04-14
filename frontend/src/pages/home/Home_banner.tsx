import bannerMobile from "@/shared/assets/images/home_banner_mobile.webp";
import bannerPc from "@/shared/assets/images/home_banner_pc.webp";
import { Link } from "react-router-dom";

const Home_banner = () => {
  return (
    <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
      <img
        src={bannerMobile}
        alt="banner mobile"
        className="object-cover w-full h-full md:hidden"
      />
      <img
        src={bannerPc}
        alt="banner mobile"
        className="hidden object-cover w-full h-full md:block"
      />

      <Link to={"/products"} className="absolute">
        <button className="px-4 py-2 text-white bg-secondary rounded-xl text-[.9rem] hover:text-opacity-80 transition-all duration-500">
          SHOP HERE
        </button>
      </Link>
    </div>
  );
};

export default Home_banner;
