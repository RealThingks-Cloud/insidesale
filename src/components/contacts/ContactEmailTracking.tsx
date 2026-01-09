import { Mail } from 'lucide-react';

interface ContactEmailTrackingProps {
  emailOpens: number;
}

export const ContactEmailTracking = ({
  emailOpens,
}: ContactEmailTrackingProps) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Mail className="h-4 w-4 text-blue-500" />
      <span className="text-muted-foreground">Opens:</span>
      <span className="font-semibold">{emailOpens}</span>
    </div>
  );
};
