import React from "react";
import { IoMdClose } from "react-icons/io";


interface CartHeaderProps {
  onClose: () => void;
}

const CartHeader = ({ onClose }: CartHeaderProps) => {
  return (
    <div className="flex justify-between p-4">
      <h2>Cart</h2>

      <button aria-label="Close" onClick={onClose}>
        <IoMdClose />
      </button>
    </div>
  );
};

export default CartHeader;
