import { Link } from "react-router-dom";
import ContainerVerifyEmail from "./ContainerVerifyEmail";

const VerifyEmailSuccess = () => {
  return (
    <ContainerVerifyEmail>
      <section className="text-white bg-black rounded-md p-7 w-[95%] lg:max-w-[500px]">
        <p className="mb-5 text-2xl">
          Verifikasi email berhasil <br /> silahkan login
        </p>
        <Link to={"/account"}>
          <button className="w-full px-6 py-4 font-sans text-xl font-bold text-black bg-white rounded-md hover:bg-gray-100">
            Login Page {">>"}
          </button>
        </Link>
      </section>
    </ContainerVerifyEmail>
  );
};

export default VerifyEmailSuccess;
