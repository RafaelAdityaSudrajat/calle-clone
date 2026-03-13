import OrdersTabs from "./OrdersTabs";
import WishlistTabs from "./WishlistTabs";

interface TabsContentProps {
  tab: "orders" | "wishlist";
}

const TabsContent = ({ tab }: TabsContentProps) => {
  console.log(tab);
  return (
    <>
      {(tab === "orders" || tab === null) && <OrdersTabs />}
      {tab === "wishlist" && <WishlistTabs />}
    </>
  );
};

export default TabsContent;
