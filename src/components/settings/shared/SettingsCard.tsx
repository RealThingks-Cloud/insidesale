import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}
const SettingsCard = ({
  icon: Icon,
  title,
  description,
  children
}: SettingsCardProps) => {
  return <Card>
      <CardHeader className="pb-3">
        
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>;
};
export default SettingsCard;