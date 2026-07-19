interface ButtonPrimaryProps {
  title: string;
  handleFunction?: () => void;
}

const ButtonPrimary = ({ title, handleFunction }: ButtonPrimaryProps) => {
  return (
    <button
      className="w-full py-3 font-medium text-white bg-black rounded-lg"
      onClick={handleFunction}
    >
      {title}
    </button>
  );
};

export default ButtonPrimary;
