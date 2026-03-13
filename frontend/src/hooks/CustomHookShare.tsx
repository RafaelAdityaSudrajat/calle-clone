import { useEffect, useState } from "react";

export const UseTrigger = () => {
  const [trigger, setTrigger] = useState<boolean>(false);

  useEffect(() => {
    if (trigger) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    // cleanup (penting!)
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [trigger]);

  const handleTrigger = () => {
    setTrigger((prev) => !prev);
  };

  return { trigger, handleTrigger };
};

export default UseTrigger;
