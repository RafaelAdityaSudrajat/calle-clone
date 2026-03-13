import DropDownMobile from "./DropDownMobile";
import DropDownPc from "./DropDownPc";

const Home_DropDown = () => {
  return (
    <>
      <div className="md:hidden">
        <DropDownMobile />
      </div>

      <div className="hidden md:block">
        <DropDownPc />
      </div>
    </>
  );
};

export default Home_DropDown;
