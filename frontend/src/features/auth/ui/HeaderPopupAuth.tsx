import { useAuthModal } from "./AuthModalContext";

interface HeaderPopupAuthProps {
  label: string;
}

const HeaderPopupAuth = ({ label }: HeaderPopupAuthProps) => {
  const { onCloseActiveAuthPopup } = useAuthModal();

  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
      <button
        className="text-xl text-gray-500 hover:text-gray-700"
        onClick={onCloseActiveAuthPopup}
      >
        ×
      </button>
    </div>
  );
};

export default HeaderPopupAuth;
