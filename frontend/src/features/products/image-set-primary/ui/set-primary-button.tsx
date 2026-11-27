import { Button } from "@/shared/ui";
import { useSetPrimaryImage } from "../model/use-set-primary-image";

interface SetPrimaryButtonProps {
  productId: string;
  imageId: string;
}

export const SetPrimaryButton = ({ productId, imageId }: SetPrimaryButtonProps) => {
  const { mutate, isPending } = useSetPrimaryImage(productId);

  return (
    <Button
      variant="secondary"
      className="px-3 py-1.5"
      isLoading={isPending}
      onClick={() => mutate(imageId)}
    >
      Jadikan utama
    </Button>
  );
};