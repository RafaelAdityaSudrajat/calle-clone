type CardDashboardSecondaryProps = {
  children: React.ReactNode;
  className?: string;
};

function CardDashboardSecondary({ children, className = '' }: CardDashboardSecondaryProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

export default CardDashboardSecondary
