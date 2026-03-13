import { IoMdClose } from "react-icons/io";

const Sort = () => {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-8 text-[1.2rem]">
        <p>Sort Products by</p>
        <IoMdClose className="text-bold " />
      </div>

      <ul className="flex flex-col gap-3 text-[.9rem] mb-8">
        <li>Featured</li>
        <li>Recent</li>
        <li>Oldest</li>
        <li>Featured</li>
        <li>Recent</li>
        <li>Oldest</li>
        <li>Featured</li>
      </ul>
    </div>
  );
};

export default Sort;
