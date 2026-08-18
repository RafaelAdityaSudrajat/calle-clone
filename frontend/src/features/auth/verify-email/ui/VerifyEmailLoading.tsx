import ContainerVerifyEmail from "./ContainerVerifyEmail";

const VerifyEmailLoading = () => {
  return (
    <ContainerVerifyEmail>
      <section className="text-white bg-black rounded-md p-7 w-[95%] lg:max-w-[500px]">
        <p className="mb-5 text-2xl">Verifying your email...</p>
      </section>
    </ContainerVerifyEmail>
  );
};

export default VerifyEmailLoading;
