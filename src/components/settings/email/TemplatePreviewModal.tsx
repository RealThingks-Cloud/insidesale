import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Code, Mail } from 'lucide-react';

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    name: string;
    subject: string;
    body: string;
  } | null;
}

// Sample data for preview
const sampleData = {
  '{{contact_name}}': 'John Doe',
  '{{company_name}}': 'Acme Corporation',
  '{{position}}': 'Sales Manager',
  '{{email}}': 'john.doe@acme.com',
  '{{phone}}': '+1 (555) 123-4567',
  '{{website}}': 'www.acme.com',
  '{{lead_name}}': 'Jane Smith',
  '{{account_name}}': 'Enterprise Solutions Inc.',
};

const renderWithVariables = (text: string): string => {
  let rendered = text;
  Object.entries(sampleData).forEach(([variable, value]) => {
    rendered = rendered.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  return rendered;
};

const TemplatePreviewModal = ({ open, onOpenChange, template }: TemplatePreviewModalProps) => {
  if (!template) return null;

  const renderedSubject = renderWithVariables(template.subject);
  const renderedBody = renderWithVariables(template.body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview: {template.name}
          </DialogTitle>
          <DialogDescription>
            See how your template looks with sample data
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="gap-2">
              <Mail className="h-4 w-4" />
              Rendered Preview
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2">
              <Code className="h-4 w-4" />
              Variables View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-4">
            <div className="border rounded-lg overflow-hidden bg-background">
              {/* Email Header */}
              <div className="border-b p-4 bg-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">To:</span>
                    <span className="text-sm">{sampleData['{{email}}']}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">Subject:</span>
                    <span className="text-sm font-medium">{renderedSubject}</span>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <ScrollArea className="h-[300px]">
                <div className="p-4 whitespace-pre-wrap text-sm">
                  {renderedBody}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="variables" className="flex-1 overflow-hidden mt-4">
            <ScrollArea className="h-[380px]">
              <div className="space-y-4">
                {/* Subject with variables highlighted */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Subject</h4>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <HighlightedText text={template.subject} />
                  </div>
                </div>

                {/* Body with variables highlighted */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Body</h4>
                  <div className="p-3 bg-muted/30 rounded-lg whitespace-pre-wrap">
                    <HighlightedText text={template.body} />
                  </div>
                </div>

                {/* Sample Data Legend */}
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-medium">Sample Data Used</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(sampleData).map(([variable, value]) => (
                      <div key={variable} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {variable}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="truncate">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Component to highlight variables in text
const HighlightedText = ({ text }: { text: string }) => {
  const variablePattern = /(\{\{[^}]+\}\})/g;
  const parts = text.split(variablePattern);

  return (
    <span className="text-sm">
      {parts.map((part, index) => {
        if (variablePattern.test(part)) {
          return (
            <Badge key={index} variant="secondary" className="mx-0.5 font-mono text-xs">
              {part}
            </Badge>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default TemplatePreviewModal;
