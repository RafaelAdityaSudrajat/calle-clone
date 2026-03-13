import Home_banner from "./Home_banner";
import Home_DropDown from "../../layout/footer/Footer";
import LayoutPrimary from "../../layout/LayoutPrimary";

const Home = () => {
  return (
    <LayoutPrimary>
      <Home_banner />
      <Home_DropDown />
    </LayoutPrimary>
  );
};

export default Home;
