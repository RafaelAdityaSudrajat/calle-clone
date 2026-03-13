import React from "react";
import IconPlaceholder from "../componentsShared/IconPlaceHolder";

interface CartHeaderProps {
  onClose: () => void;
}

const CartHeader = ({ onClose }: CartHeaderProps) => {
  return (
    <div className="flex justify-between px-4 pt-4">
      <h2>Cart</h2>

      <button aria-label="Close" onClick={onClose}>
        <IconPlaceholder />
      </button>
    </div>
  );
};

export default CartHeader;
