import Home_banner from "./Home_banner";
import Home_DropDown from "@/widgets/layout/footer/Footer";
import LayoutPrimary from "@/widgets/layout/LayoutPrimary";

const Home = () => {
  return (
    <LayoutPrimary>
      <Home_banner />
      <Home_DropDown />
    </LayoutPrimary>
  );
};

export default Home;
